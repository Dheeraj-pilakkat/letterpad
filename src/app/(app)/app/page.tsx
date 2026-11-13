import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { toPdfDoc } from "@/lib/serialize";
import { monthlySeries, summarizeFinance } from "@/lib/finance";
import { quoteConversion, rangeToMonths, topClients, type RangeKey } from "@/lib/analytics";
import { ACTIVITY_LABELS } from "@/lib/constants";
import { TYPE_META } from "@/lib/templates/registry";
import { cn, formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { MonthlyBars } from "@/components/app/monthly-bars";

export const metadata: Metadata = { title: "Overview" };

const RANGES: Array<[RangeKey, string]> = [
  ["6m", "6 months"],
  ["12m", "12 months"],
  ["ytd", "Year to date"],
];

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { range: rangeRaw } = await searchParams;
  const range: RangeKey =
    rangeRaw === "6m" || rangeRaw === "12m" || rangeRaw === "ytd" ? rangeRaw : "12m";

  const [recent, byStatus, invoices, payments, expenses, activity, analyticsDocs, people] =
    await Promise.all([
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
      collections
        .documents()
        .find({ workspaceId: workspace._id, deletedAt: null, type: "invoice" })
        .toArray(),
      collections.payments().find({ workspaceId: workspace._id }).toArray(),
      collections.expenses().find({ workspaceId: workspace._id }).toArray(),
      collections
        .activity()
        .find({ workspaceId: workspace._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray(),
      collections
        .documents()
        .find(
          { workspaceId: workspace._id, deletedAt: null },
          { projection: { _id: 1, contactId: 1, status: 1, type: 1 } },
        )
        .toArray(),
      collections
        .contacts()
        .find(
          { workspaceId: workspace._id },
          { projection: { _id: 1, name: 1 } },
        )
        .toArray(),
    ]);

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));
  const total = byStatus.reduce((s, r) => s + r.count, 0);

  const finance = summarizeFinance({ invoices, payments, expenses });

  // quote conversion — quotes that left draft
  const conversion = quoteConversion(
    analyticsDocs.filter((d) => d.type === "quote").map((d) => d.status),
  );

  // top clients by received (non-refunded) payments
  const docContacts = new Map(
    analyticsDocs.map((d) => [d._id.toHexString(), d.contactId?.toHexString() ?? null]),
  );
  const top = topClients(
    payments
      .filter((p) => !p.refunded)
      .map((p) => ({
        contactId: docContacts.get(p.documentId.toHexString()) ?? null,
        amount: p.amount,
      })),
    5,
  );
  const contactNames = new Map(people.map((c) => [c._id.toHexString(), c.name]));

  const revenue = monthlySeries({
    payments,
    expenses,
    months: rangeToMonths(range),
  });

  const quickActions = (
    ["quote", "invoice", "receipt", "letter", "request"] as const
  ).map((type) => ({
    type,
    label: `New ${TYPE_META[type].label.toLowerCase()}`,
    blurb: TYPE_META[type].blurb,
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          {workspace.name} · {total} document{total === 1 ? "" : "s"} on record
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["Drafts", "draft"],
            ["Sent", "sent"],
            ["Viewed", "viewed"],
            ["Paid", "paid"],
            ["Overdue", "overdue"],
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

      {/* finance summary */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Money</h2>
          <Link href="/app/finance" className="text-sm text-royal hover:underline">
            Finance →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["Invoiced", finance.invoiced],
              ["Received", finance.received],
              ["Outstanding", finance.outstanding],
              ["Expenses", finance.expenses],
            ] as const
          ).map(([label, value]) => (
            <Card key={label} className="p-4">
              <p className="text-xs text-muted">{label}</p>
              <p className="mt-1 font-display text-xl text-ink">
                {formatMoney(value, workspace.currency)}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* analytics: conversion + revenue + top clients */}
      <section className="mb-10 grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Quote conversion</h2>
            <Link href="/app/documents" className="text-xs text-royal hover:underline">
              Quotes →
            </Link>
          </div>
          <p className="font-display text-3xl text-ink">
            {conversion.winRate}
            <span className="text-lg">%</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            win rate · {conversion.sent} quote{conversion.sent === 1 ? "" : "s"} sent
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted">Won</dt>
              <dd className="tabular-nums text-ink">{conversion.won}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Lost</dt>
              <dd className="tabular-nums text-ink">{conversion.lost}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Open</dt>
              <dd className="tabular-nums text-ink">{conversion.open}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Expired</dt>
              <dd className="tabular-nums text-ink">{conversion.expired}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium text-ink">Revenue vs expenses</h2>
            <div className="flex gap-1">
              {RANGES.map(([value, label]) => (
                <Link
                  key={value}
                  href={value === "12m" ? "/app" : `/app?range=${value}`}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                    range === value
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-muted hover:border-ink/40",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <MonthlyBars points={revenue} currency={workspace.currency} />
        </Card>
      </section>

      <section className="mb-10 grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Top clients</h2>
            <Link href="/app/contacts" className="text-xs text-royal hover:underline">
              Contacts →
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="text-sm text-muted">
              Payments you record will be ranked here by client.
            </p>
          ) : (
            <ol className="space-y-2">
              {top.map((row, i) => (
                <li key={row.contactId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 text-xs tabular-nums text-muted">{i + 1}</span>
                    <span className="truncate text-ink">
                      {contactNames.get(row.contactId) ?? "Unknown client"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">
                    {formatMoney(row.total, workspace.currency)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium text-ink">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">
              Status changes, shares and payments show up here as they happen.
            </p>
          ) : (
            <ul className="space-y-2">
              {activity.map((e) => (
                <li key={e._id.toHexString()} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="mr-1.5 text-xs font-medium text-royal">
                      {ACTIVITY_LABELS[e.type] ?? e.type}
                    </span>
                    <span className="truncate text-ink">{e.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {new Date(e.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-ink">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickActions.map(({ type, label, blurb }) => (
            <Link
              key={type}
              href={`/app/documents/new?type=${type}`}
              className="group rounded-[4px] border border-line bg-white p-4 transition-colors hover:border-royal"
            >
              <p className="font-medium text-ink group-hover:text-royal">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Recent documents</h2>
          <Link href="/app/documents" className="text-sm text-royal hover:underline">
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
