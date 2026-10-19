import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { toPdfDoc } from "@/lib/serialize";
import { TYPE_META } from "@/lib/templates/registry";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const { workspace } = await requireWorkspace();

  const [recent, byStatus] = await Promise.all([
    collections
      .documents()
      .find({ workspaceId: workspace._id })
      .sort({ updatedAt: -1 })
      .limit(6)
      .toArray(),
    collections
      .documents()
      .aggregate<{ _id: string; count: number }>([
        { $match: { workspaceId: workspace._id } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
  const total = byStatus.reduce((s, r) => s + r.count, 0);

  const quickActions = (["quote", "invoice", "request", "letter"] as const).map(
    (type) => ({
      type,
      label: `New ${TYPE_META[type].label.toLowerCase()}`,
      blurb: TYPE_META[type].blurb,
    }),
  );

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          {workspace.name} · {total} document{total === 1 ? "" : "s"} on record
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Drafts", "draft"],
            ["Sent", "sent"],
            ["Paid", "paid"],
            ["Accepted", "accepted"],
          ] as const
        ).map(([label, key]) => (
          <Card key={key} className="p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 font-display text-2xl text-ink">
              {statusCounts[key] ?? 0}
            </p>
          </Card>
        ))}
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-ink">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ type, label, blurb }) => (
            <Link
              key={type}
              href={`/app/documents/new?type=${type}`}
              className="group rounded-[4px] border border-line bg-white p-4 transition-colors hover:border-copper"
            >
              <p className="font-medium text-ink group-hover:text-copper">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Recent documents</h2>
          <Link href="/app/documents" className="text-sm text-copper hover:underline">
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card className="text-center text-sm text-muted">
            Nothing here yet — create your first quotation from a template.
          </Card>
        ) : (
          <div className="divide-y divide-line rounded-[4px] border border-line bg-white">
            {recent.map((doc) => {
              const d = toPdfDoc(doc);
              return (
                <Link
                  key={doc._id.toHexString()}
                  href={`/app/documents/${doc._id.toHexString()}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-paper"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {doc.number} · {doc.title || TYPE_META[doc.type].label}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <TypeBadge type={doc.type} />
                      {new Date(doc.updatedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {d.total > 0 ? (
                      <span className="text-sm tabular-nums text-ink">
                        {formatMoney(d.total, d.currency)}
                      </span>
                    ) : null}
                    <StatusBadge status={doc.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
