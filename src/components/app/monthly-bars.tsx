import type { MonthlyPoint } from "@/lib/finance";
import { formatMoney } from "@/lib/utils";

/** Compact income/expense bar chart for the Overview dashboard. */
export function MonthlyBars({
  points,
  currency,
}: {
  points: MonthlyPoint[];
  currency: string;
}) {
  const peak = Math.max(1, ...points.map((m) => Math.max(m.income, m.expense)));
  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {points.map((m) => (
          <div
            key={m.month}
            className="flex h-full flex-1 items-end justify-center gap-0.5"
            title={`${m.month}: income ${formatMoney(m.income, currency)}, expenses ${formatMoney(m.expense, currency)}`}
          >
            <div
              className="w-1/2 max-w-3 rounded-t-[2px] bg-royal"
              style={{ height: `${Math.max(2, (m.income / peak) * 100)}%` }}
            />
            <div
              className="w-1/2 max-w-3 rounded-t-[2px] bg-line"
              style={{ height: `${Math.max(2, (m.expense / peak) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {points.map((m) => (
          <p key={m.month} className="flex-1 text-center text-[10px] text-muted">
            {m.month.slice(5)}
          </p>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-royal" /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-line" /> Expenses
        </span>
      </div>
    </div>
  );
}
