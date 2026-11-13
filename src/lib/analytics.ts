import type { DocumentStatus } from "@/lib/db/types";
import { round2 } from "@/lib/utils";

/* ============================================================
   Pure analytics helpers for the Overview dashboard.
   ============================================================ */

export type QuoteOutcome = "open" | "won" | "lost" | "expired";

/** Classify a quote's status for conversion tracking. */
export function classifyQuote(status: DocumentStatus): QuoteOutcome {
  if (status === "accepted" || status === "paid") return "won";
  if (status === "rejected") return "lost";
  if (status === "expired") return "expired";
  return "open";
}

export interface ConversionStats {
  /** Quotes that left draft (sent/viewed/accepted/rejected/overdue/expired) */
  sent: number;
  won: number;
  lost: number;
  expired: number;
  /** Quotes still awaiting a decision */
  open: number;
  /** won / (won + lost) as a percentage, 0 when nothing was decided */
  winRate: number;
}

/** Quote conversion stats. Drafts are excluded from `sent`. */
export function quoteConversion(
  statuses: DocumentStatus[],
): ConversionStats {
  let sent = 0;
  let won = 0;
  let lost = 0;
  let expired = 0;
  let open = 0;
  for (const status of statuses) {
    if (status === "draft" || status === "void") continue;
    sent += 1;
    const outcome = classifyQuote(status);
    if (outcome === "won") won += 1;
    else if (outcome === "lost") lost += 1;
    else if (outcome === "expired") expired += 1;
    else open += 1;
  }
  const decided = won + lost;
  return {
    sent,
    won,
    lost,
    expired,
    open,
    winRate: decided === 0 ? 0 : round2((won / decided) * 100),
  };
}

/** Sum rows by contact and return the top N (ties broken by contact id). */
export function topClients<T extends { contactId: string | null; amount: number }>(
  rows: T[],
  limit = 5,
): Array<{ contactId: string; total: number }> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    if (!row.contactId || row.amount <= 0) continue;
    sums.set(row.contactId, round2((sums.get(row.contactId) ?? 0) + row.amount));
  }
  return [...sums.entries()]
    .map(([contactId, total]) => ({ contactId, total }))
    .sort((a, b) => b.total - a.total || a.contactId.localeCompare(b.contactId))
    .slice(0, limit);
}

export type RangeKey = "6m" | "12m" | "ytd";

/** Map a dashboard range selector to a monthlySeries `months` count. */
export function rangeToMonths(range: RangeKey, today = new Date()): number {
  if (range === "6m") return 6;
  if (range === "12m") return 12;
  // months elapsed this year, at least 1
  return Math.max(1, today.getMonth() + 1);
}
