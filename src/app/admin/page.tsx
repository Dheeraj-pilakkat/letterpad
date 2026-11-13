import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { collections } from "@/lib/db/client";
import { PLANS, currentPlanId, isPlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const db = getDb();
  const [userCount, workspaceCount, subscriptionWorkspaces, recent] =
    await Promise.all([
      db.collection("user").countDocuments(),
      collections.workspaces().countDocuments(),
      collections
        .workspaces()
        .find({ "subscription.plan": { $exists: true } })
        .toArray(),
      collections
        .workspaces()
        .find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray(),
    ]);

  let activeSubs = 0;
  let mrrInr = 0;
  for (const ws of subscriptionWorkspaces) {
    const planId = currentPlanId(ws);
    if (planId !== "free") {
      activeSubs += 1;
      mrrInr += PLANS[planId].priceInr;
    }
  }

  const stats = [
    { label: "Users", value: userCount },
    { label: "Workspaces", value: workspaceCount },
    { label: "Active subscriptions", value: activeSubs },
    { label: "MRR (indicative, INR)", value: `₹${mrrInr.toLocaleString("en-IN")}` },
  ];

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Platform-wide overview. Plan prices are the indicative §20 monthly
          rates.
        </p>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-[4px] border border-line bg-white p-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-1 font-display text-3xl text-ink">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[4px] border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-medium text-ink">Recent workspaces</h2>
          <Link href="/admin/workspaces" className="text-xs text-royal hover:underline">
            View all →
          </Link>
        </div>
        <ul className="divide-y divide-line">
          {recent.map((ws) => (
            <li
              key={ws._id.toHexString()}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{ws.name}</p>
                <p className="truncate text-xs text-muted">{ws.slug}</p>
              </div>
              <span className="shrink-0 rounded-full bg-paper-dim px-2 py-0.5 text-xs text-ink-soft">
                {isPlanId(currentPlanId(ws)) ? PLANS[currentPlanId(ws)].name : "Free"}
              </span>
            </li>
          ))}
          {recent.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">No workspaces yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
