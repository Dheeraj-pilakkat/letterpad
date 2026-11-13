import type { Metadata } from "next";
import { getDb, collections } from "@/lib/db/client";
import { PLANS, currentPlanId } from "@/lib/plans";
import { maskApiKey } from "@/lib/api-key";
import { SetPlanControl } from "@/components/admin/set-plan-control";

export const metadata: Metadata = { title: "Admin · Workspaces" };

export default async function AdminWorkspacesPage() {
  const workspaces = await collections
    .workspaces()
    .find({})
    .sort({ createdAt: -1 })
    .limit(300)
    .toArray();

  const ownerIds: string[] = [
    ...new Set(workspaces.map((w) => w.ownerUserId)),
  ];
  const users = await getDb()
    .collection<{ _id: string; email: string; name?: string }>("user")
    .find({ _id: { $in: ownerIds } })
    .toArray();
  const emailById = new Map(users.map((u) => [String(u._id), u.email]));

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Workspaces</h1>
        <p className="mt-1 text-sm text-muted">
          {workspaces.length} most recent workspaces (max 300 shown).
        </p>
      </header>

      <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Set plan</th>
              <th className="px-4 py-3 font-medium">Flags</th>
              <th className="px-4 py-3 font-medium">API key</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {workspaces.map((ws) => {
              const planId = currentPlanId(ws);
              const flags = [
                ws.whiteLabel ? "white-label" : null,
                ws.gstEnabled ? "GST" : null,
                ws.webhook?.enabled ? "webhook" : null,
              ].filter(Boolean);
              return (
                <tr key={ws._id.toHexString()} className="hover:bg-paper">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{ws.name}</p>
                    <p className="text-xs text-muted">{ws.slug}</p>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-ink-soft">
                    {emailById.get(String(ws.ownerUserId)) ?? ws.ownerUserId}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-paper-dim px-2 py-0.5 text-xs text-ink-soft">
                      {PLANS[planId].name}
                      {ws.subscription?.status === "past_due" ? " · past due" : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <SetPlanControl
                      workspaceId={ws._id.toHexString()}
                      currentPlan={planId}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {flags.length ? flags.join(" · ") : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {ws.apiKey ? maskApiKey(ws.apiKey) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">
                    {ws.createdAt.toLocaleDateString("en-GB")}
                  </td>
                </tr>
              );
            })}
            {workspaces.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted">
                  No workspaces yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
