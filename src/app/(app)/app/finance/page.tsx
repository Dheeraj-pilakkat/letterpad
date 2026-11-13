import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { Card, EmptyState } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import {
  balanceOf,
  EXPENSE_CATEGORIES,
  monthlySeries,
  sumPayments,
  summarizeFinance,
} from "@/lib/finance";
import { formatMoney, formatDate } from "@/lib/utils";
import { ExportCsvButton } from "@/components/finance/export-csv-button";
import { ReminderButton, RemindAllButton } from "@/components/finance/reminder-button";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  const { workspace } = await requireWorkspace();

  const [invoices, payments, expenses, contacts] = await Promise.all([
    collections
      .documents()
      .find({ workspaceId: workspace._id, deletedAt: null, type: "invoice" })
      .sort({ issueDate: -1 })
      .toArray(),
    collections
      .payments()
      .find({ workspaceId: workspace._id })
      .sort({ date: -1, createdAt: -1 })
      .toArray(),
    collections
      .expenses()
      .find({ workspaceId: workspace._id })
      .sort({ date: -1, createdAt: -1 })
      .toArray(),
    collections
      .contacts()
      .find({ workspaceId: workspace._id })
      .sort({ name: 1 })
      .toArray(),
  ]);

  const paymentsByDoc = new Map<string, typeof payments>();
  for (const p of payments) {
    const key = p.documentId.toHexString();
    const list = paymentsByDoc.get(key) ?? [];
    list.push(p);
    paymentsByDoc.set(key, list);
  }
  const contactName = (id: { toHexString(): string } | null) => {
    if (!id) return "—";
    return contacts.find((c) => c._id.toHexString() === id.toHexString())?.name ?? "—";
  };

  const summary = summarizeFinance({
    invoices,
    payments,
    expenses,
  });

  const outstanding = invoices
    .map((doc) => {
      const paid = sumPayments(paymentsByDoc.get(doc._id.toHexString()) ?? []);
      return { doc, paid, balance: balanceOf(doc.total, paymentsByDoc.get(doc._id.toHexString()) ?? []) };
    })
    .filter((r) => r.balance > 0 && r.doc.status !== "void")
    .sort((a, b) => (a.doc.dueDate ?? "9999").localeCompare(b.doc.dueDate ?? "9999"));

  const today = new Date().toISOString().slice(0, 10);
  const hasOverdue = outstanding.some(
    (r) => r.doc.status === "overdue" || (r.doc.dueDate && r.doc.dueDate < today),
  );

  const months = monthlySeries({ payments, expenses });
  const peak = Math.max(1, ...months.map((m) => Math.max(m.income, m.expense)));

  const byCategory = EXPENSE_CATEGORIES.map((cat) => {
    const total = expenses
      .filter((e) => e.category === cat.value)
      .reduce((s, e) => s + e.total, 0);
    return { ...cat, total };
  })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const expensePeak = Math.max(1, ...byCategory.map((c) => c.total));

  const recentPayments = payments.slice(0, 8);

  const csvRows = [
    ...payments.map((p) => {
      const doc = invoices.find((d) => d._id.equals(p.documentId));
      return {
        date: p.date,
        kind: p.refunded ? "refund" : "payment",
        reference: p.reference ?? doc?.number ?? "",
        description: `Payment via ${p.method}`,
        income: p.refunded ? -p.amount : p.amount,
        expense: 0,
      };
    }),
    ...expenses.map((e) => ({
      date: e.date,
      kind: "expense",
      reference: e.vendor ?? "",
      description: e.description,
      income: 0,
      expense: e.total,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: "Invoiced", value: formatMoney(summary.invoiced, workspace.currency) },
    { label: "Received", value: formatMoney(summary.received, workspace.currency) },
    { label: "Outstanding", value: formatMoney(summary.outstanding, workspace.currency) },
    { label: "Expenses", value: formatMoney(summary.expenses, workspace.currency) },
    { label: "Net income", value: formatMoney(summary.netIncome, workspace.currency) },
    {
      label: "GST payable",
      value: formatMoney(summary.taxPayable, workspace.currency),
      hint: `Output ${formatMoney(summary.taxCollected, workspace.currency)} − input ${formatMoney(summary.taxOnExpenses, workspace.currency)}`,
    },
  ];

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Finance</h1>
          <p className="mt-1 text-sm text-muted">
            What you have invoiced, received and still need to collect.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/expenses"
            className="inline-flex h-10 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
          >
            Expenses
          </Link>
          <ExportCsvButton rows={csvRows} />
          {hasOverdue ? <RemindAllButton /> : null}
          <Link
            href="/app/documents/new?type=invoice"
            className="inline-flex h-10 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
          >
            + New bill
          </Link>
        </div>
      </header>

      {/* summary */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 font-display text-xl text-ink">{s.value}</p>
            {s.hint ? <p className="mt-0.5 text-[11px] text-muted">{s.hint}</p> : null}
          </Card>
        ))}
      </div>

      {/* income vs expenses */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-ink">Income vs expenses</h2>
        <Card>
          <div className="flex h-44 items-end gap-3 sm:gap-6">
            {months.map((m) => (
              <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 max-w-8 rounded-t-[2px] bg-forest/80"
                    style={{ height: `${Math.max(2, (m.income / peak) * 100)}%` }}
                    title={`Income ${formatMoney(m.income, workspace.currency)}`}
                  />
                  <div
                    className="w-1/2 max-w-8 rounded-t-[2px] bg-amber/70"
                    style={{ height: `${Math.max(2, (m.expense / peak) * 100)}%` }}
                    title={`Expenses ${formatMoney(m.expense, workspace.currency)}`}
                  />
                </div>
                <span className="text-[10px] text-muted">
                  {new Date(`${m.month}-01T00:00:00`).toLocaleDateString("en-GB", {
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 border-t border-line pt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-forest/80" /> Income (payments)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-amber/70" /> Expenses
            </span>
          </div>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* outstanding */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Outstanding payments</h2>
            <Link href="/app/documents?type=invoice" className="text-sm text-royal hover:underline">
              All bills →
            </Link>
          </div>
          {outstanding.length === 0 ? (
            <EmptyState
              title="Nothing to collect"
              description="Every bill is settled — new invoices with a balance show up here."
            />
          ) : (
            <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">Number</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Reminder</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {outstanding.map(({ doc, paid, balance }) => (
                    <tr key={doc._id.toHexString()} className="hover:bg-paper">
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/documents/${doc._id.toHexString()}`}
                          className="font-medium text-ink hover:text-royal"
                        >
                          {doc.number}
                        </Link>
                        <span className="ml-2 inline-block align-middle">
                          <StatusBadge status={doc.status} />
                        </span>
                      </td>
                      <td className="max-w-32 truncate px-4 py-3 text-muted">
                        {contactName(doc.contactId)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">
                        {formatMoney(balance, doc.currency)}
                        {paid > 0 ? (
                          <span className="block text-[11px] text-muted">
                            of {formatMoney(doc.total, doc.currency)}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          doc.dueDate && doc.dueDate < new Date().toISOString().slice(0, 10)
                            ? "text-red"
                            : "text-muted"
                        }`}
                      >
                        {doc.dueDate ? formatDate(doc.dueDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ReminderButton
                          documentId={doc._id.toHexString()}
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* expenses by category */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-ink">Expenses by category</h2>
            <Link href="/app/expenses" className="text-sm text-royal hover:underline">
              Manage →
            </Link>
          </div>
          {byCategory.length === 0 ? (
            <EmptyState
              title="No expenses yet"
              description="Record business expenses to see net income and GST input tax here."
              action={
                <Link
                  href="/app/expenses"
                  className="inline-flex h-9 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
                >
                  Add expense
                </Link>
              }
            />
          ) : (
            <Card>
              <ul className="space-y-3">
                {byCategory.map((c) => (
                  <li key={c.value}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-ink">{c.label}</span>
                      <span className="tabular-nums text-ink">
                        {formatMoney(c.total, workspace.currency)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-paper-dim">
                      <div
                        className="h-full rounded-full bg-royal/70"
                        style={{ width: `${Math.max(3, (c.total / expensePeak) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      {/* recent payments */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-ink">Recent payments</h2>
        {recentPayments.length === 0 ? (
          <Card className="text-center text-sm text-muted">
            Record a payment on a bill to start tracking what you have received.
          </Card>
        ) : (
          <div className="divide-y divide-line rounded-[4px] border border-line bg-white">
            {recentPayments.map((p) => {
              const doc = invoices.find((d) => d._id.equals(p.documentId));
              return (
                <div
                  key={p._id.toHexString()}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink">
                      {doc ? (
                        <Link
                          href={`/app/documents/${doc._id.toHexString()}`}
                          className="font-medium hover:text-royal"
                        >
                          {doc.number}
                        </Link>
                      ) : (
                        <span className="font-medium">Payment</span>
                      )}
                      <span className="ml-2 text-muted">{contactName(doc?.contactId ?? null)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDate(p.date)} · {p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.refunded ? " · refunded" : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${p.refunded ? "text-red line-through" : "text-forest"}`}
                  >
                    {p.refunded ? "−" : "+"}
                    {formatMoney(p.amount, workspace.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* type mix footer note */}
      <p className="mt-8 text-xs text-muted">
        {invoices.length} bill{invoices.length === 1 ? "" : "s"} · {payments.length} payment
        {payments.length === 1 ? "" : "s"} · {expenses.length} expense
        {expenses.length === 1 ? "" : "s"} on record.{" "}
        <TypeBadge type="invoice" />
      </p>
    </div>
  );
}
