import type { Metadata } from "next";
import { collections } from "@/lib/db/client";
import { PLANS, currentPlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin · Subscriptions" };

export default async function AdminSubscriptionsPage() {
  const withSubs = await collections
    .workspaces()
    .find({ "subscription.plan": { $exists: true } })
    .sort({ "subscription.updatedAt": -1 })
    .limit(300)
    .toArray();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Subscriptions</h1>
        <p className="mt-1 text-sm text-muted">
          Workspaces with plan history. Provider &quot;manual&quot; means it was
          set from this panel; &quot;razorpay&quot; was paid through Checkout.
        </p>
      </header>

      <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Workspace</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Renews / ended</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {withSubs.map((ws) => {
              const sub = ws.subscription;
              if (!sub) return null;
              const planId = currentPlanId(ws);
              const statusStyle =
                sub.status === "active" && planId !== "free"
                  ? "bg-forest/10 text-forest"
                  : sub.status === "past_due"
                    ? "bg-red/10 text-red"
                    : "bg-paper-dim text-muted";
              return (
                <tr key={ws._id.toHexString()} className="hover:bg-paper">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-ink">{ws.name}</p>
                    <p className="text-xs text-muted">{ws.slug}</p>
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">
                    {PLANS[planId].name}
                    <span className="ml-1 text-xs text-muted">
                      (stored: {sub.plan})
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle}`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">
                    {sub.currentPeriodEnd ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {sub.provider ?? "—"}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 font-mono text-xs text-muted">
                    {sub.referenceId ?? "—"}
                  </td>
                </tr>
              );
            })}
            {withSubs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted">
                  No subscriptions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
