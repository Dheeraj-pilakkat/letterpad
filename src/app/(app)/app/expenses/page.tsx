import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { Card, EmptyState } from "@/components/ui/card";
import { ExpenseForm, DeleteExpenseButton } from "@/components/finance/expense-form";
import { EXPENSE_CATEGORIES, summarizeFinance } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const { workspace } = await requireWorkspace();
  const expenses = await collections
    .expenses()
    .find({ workspaceId: workspace._id })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  const total = expenses.reduce((s, e) => s + e.total, 0);
  const taxTotal = expenses.reduce((s, e) => s + e.taxAmount, 0);

  const { taxOnExpenses } = summarizeFinance({ invoices: [], payments: [], expenses });

  const labelFor = (value: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Expenses</h1>
          <p className="mt-1 text-sm text-muted">
            {expenses.length} record{expenses.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(total, workspace.currency)} total
            {taxTotal > 0
              ? ` · ${formatMoney(taxTotal, workspace.currency)} tax (input credit)`
              : ""}
          </p>
        </div>
        <Link
          href="/app/finance"
          className="inline-flex h-10 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
        >
          ← Finance
        </Link>
      </header>

      <div className="mb-8">
        <Card>
          <h2 className="mb-4 text-sm font-medium text-ink">Add expense</h2>
          <ExpenseForm />
        </Card>
      </div>

      <p className="mb-3 text-xs text-muted">
        Input tax on expenses: {formatMoney(taxOnExpenses, workspace.currency)} — offsets output
        GST in the finance summary.
      </p>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Add your first business expense above — software, rent, travel or anything else."
        />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Tax</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 text-right font-medium">Receipt</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {expenses.map((e) => (
                <tr key={e._id.toHexString()} className="hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-paper-dim px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                      {labelFor(e.category)}
                    </span>
                  </td>
                  <td className="max-w-56 px-4 py-3 text-ink">
                    <span className="block truncate">{e.description}</span>
                    {e.vendor ? (
                      <span className="block truncate text-xs text-muted">{e.vendor}</span>
                    ) : null}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {e.taxAmount > 0 ? formatMoney(e.taxAmount, workspace.currency) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {formatMoney(e.total, workspace.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {e.receipt ? (
                      <a
                        href={e.receipt}
                        target="_blank"
                        rel="noreferrer"
                        className="text-royal hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end">
                      <DeleteExpenseButton id={e._id.toHexString()} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
