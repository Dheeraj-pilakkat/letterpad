import type {
  DocumentStatus,
  DocumentType,
  ExpenseCategory,
  GstSplit,
  TemplateLayout,
} from "@/lib/db/types";
import { computeTotals } from "@/lib/validation/schemas";
import { round2, todayIsoDate } from "@/lib/utils";

/* ============================================================
   Finance core — pure helpers for payments, GST, expenses and
   reports. No database or Next.js imports: unit-tested directly.
   ============================================================ */

export const EXPENSE_CATEGORIES: Array<{
  value: ExpenseCategory;
  label: string;
}> = [
  { value: "software", label: "Software" },
  { value: "supplies", label: "Supplies" },
  { value: "travel", label: "Travel" },
  { value: "marketing", label: "Marketing" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "professional", label: "Professional fees" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

export const PAYMENT_METHODS: Array<{
  value: import("@/lib/db/types").PaymentMethod;
  label: string;
}> = [
  { value: "bank", label: "Bank transfer" },
  { value: "upi", label: "UPI" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "online", label: "Online payment" },
  { value: "other", label: "Other" },
];

/** Sum of payments that count toward the balance (refunds excluded). */
export function sumPayments(
  payments: Array<{ amount: number; refunded?: boolean }>,
): number {
  return round2(
    payments.reduce((s, p) => (p.refunded ? s : s + p.amount), 0),
  );
}

/** Amount still to collect: total minus counted payments, never negative. */
export function balanceOf(
  total: number,
  payments: Array<{ amount: number; refunded?: boolean }>,
): number {
  return Math.max(0, round2(total - sumPayments(payments)));
}

/** Status implied by the ledger: fully covered → paid. */
export function statusAfterPayment(
  total: number,
  payments: Array<{ amount: number; refunded?: boolean }>,
  current: DocumentStatus,
): DocumentStatus {
  if (total <= 0) return current;
  return sumPayments(payments) >= round2(total) ? "paid" : current;
}

/** Status after removing a payment: falls back to overdue/sent. */
export function statusAfterPaymentRemoval(
  payments: Array<{ amount: number; refunded?: boolean }>,
  total: number,
  dueDate: string | undefined,
  today = todayIsoDate(),
): DocumentStatus {
  if (balanceOf(total, payments) > 0) {
    return dueDate && dueDate < today ? "overdue" : "sent";
  }
  return "paid";
}

/* ---------------- GST ---------------- */

export interface GstInput {
  enabled: boolean;
  taxTotal: number;
  placeOfSupply?: string;
  workspaceState?: string;
  workspaceCountry?: string;
  contactState?: string;
  contactCountry?: string;
}

/**
 * Split tax into CGST+SGST (same state) or IGST (inter-state / cross-border).
 * Returns undefined when GST is off or there is no tax to split.
 */
export function resolveGst(input: GstInput): GstSplit | undefined {
  if (!input.enabled || input.taxTotal <= 0) return undefined;
  const placeOfSupply =
    input.placeOfSupply?.trim() || input.workspaceState?.trim() || "";
  const intra =
    Boolean(placeOfSupply) &&
    Boolean(input.contactState?.trim()) &&
    Boolean(input.contactCountry?.trim()) &&
    input.contactCountry === (input.workspaceCountry ?? "India") &&
    input.contactState === placeOfSupply;

  if (intra) {
    const cgst = round2(input.taxTotal / 2);
    return { placeOfSupply, cgst, sgst: round2(input.taxTotal - cgst), igst: 0 };
  }
  return {
    placeOfSupply,
    cgst: 0,
    sgst: 0,
    igst: round2(input.taxTotal),
  };
}

/** Rows for the PDF totals block, in display order. */
export function gstTotalRows(
  gst: GstSplit | undefined,
  taxTotal: number,
): Array<{ label: string; amount: number }> {
  if (!gst || taxTotal <= 0) return [];
  if (gst.igst > 0) return [{ label: "IGST", amount: gst.igst }];
  return [
    { label: "CGST", amount: gst.cgst },
    { label: "SGST", amount: gst.sgst },
  ];
}

/* ---------------- Expenses ---------------- */

/** Tax and total for an expense (tax is added on top of the net amount). */
export function expenseCalc(
  amount: number,
  taxRate: number,
): { taxAmount: number; total: number } {
  const taxAmount = round2((Math.max(0, amount) * Math.max(0, taxRate)) / 100);
  return { taxAmount, total: round2(Math.max(0, amount) + taxAmount) };
}

/* ---------------- Reports ---------------- */

export interface FinanceSummary {
  invoiced: number;
  received: number;
  outstanding: number;
  expenses: number;
  netIncome: number;
  /** Output tax collected on invoices */
  taxCollected: number;
  /** Input tax paid on expenses */
  taxOnExpenses: number;
  /** taxCollected − taxOnExpenses (GST payable, indicative) */
  taxPayable: number;
}

export function summarizeFinance(input: {
  invoices: Array<{ total: number; taxTotal?: number }>;
  payments: Array<{ amount: number; refunded?: boolean }>;
  expenses: Array<{ total: number; taxAmount?: number }>;
}): FinanceSummary {
  const invoiced = round2(input.invoices.reduce((s, d) => s + d.total, 0));
  const received = sumPayments(input.payments);
  const expenses = round2(input.expenses.reduce((s, e) => s + e.total, 0));
  const taxCollected = round2(
    input.invoices.reduce((s, d) => s + (d.taxTotal ?? 0), 0),
  );
  const taxOnExpenses = round2(
    input.expenses.reduce((s, e) => s + (e.taxAmount ?? 0), 0),
  );
  return {
    invoiced,
    received,
    outstanding: round2(Math.max(0, invoiced - received)),
    expenses,
    netIncome: round2(received - expenses),
    taxCollected,
    taxOnExpenses,
    taxPayable: round2(Math.max(0, taxCollected - taxOnExpenses)),
  };
}

export interface MonthlyPoint {
  /** "YYYY-MM" */
  month: string;
  income: number;
  expense: number;
}

/**
 * Cash-basis income vs expenses for the last `months` months (inclusive of
 * the current month). `month` is YYYY-MM so it sorts naturally.
 */
export function monthlySeries(input: {
  payments: Array<{ date: string; amount: number; refunded?: boolean }>;
  expenses: Array<{ date: string; total: number }>;
  months?: number;
  today?: string;
}): MonthlyPoint[] {
  const months = input.months ?? 6;
  const today = input.today ?? todayIsoDate();
  const [ty, tm] = today.split("-").map(Number);

  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(ty, tm - 1 - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  const points = new Map<string, MonthlyPoint>(
    keys.map((k) => [k, { month: k, income: 0, expense: 0 }]),
  );
  for (const p of input.payments) {
    if (p.refunded) continue;
    const point = points.get(p.date.slice(0, 7));
    if (point) point.income = round2(point.income + p.amount);
  }
  for (const e of input.expenses) {
    const point = points.get(e.date.slice(0, 7));
    if (point) point.expense = round2(point.expense + e.total);
  }
  return keys.map((k) => points.get(k)!);
}

/** CSV export for report tables (RFC-4180-ish escaping). */
export function financeCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

/* ---------------- Document builders (pure) ---------------- */

type InvoiceLike = {
  number: string;
  type: DocumentType;
  total: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  contactId: { toHexString(): string } | string | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  discount?: { type: "percent" | "amount"; value: number };
  content: { subject?: string; body?: string; terms?: string };
  layout: TemplateLayout;
};

function contactHex(contactId: InvoiceLike["contactId"]): string | null {
  if (!contactId) return null;
  return typeof contactId === "string" ? contactId : contactId.toHexString();
}

/** Request document for the outstanding balance of an invoice. */
export function paymentRequestPayload(
  invoice: InvoiceLike,
  balance: number,
  today = todayIsoDate(),
) {
  // Nothing collected yet → mirror the invoice's own line items for a
  // prettier request; once partial payments exist, ask for the balance.
  const fullyUnpaid = balance >= invoice.total;
  const useInvoiceItems = fullyUnpaid && invoice.items.length > 0;

  const items = useInvoiceItems
    ? invoice.items.map((i) => ({ ...i, amount: round2(i.quantity * i.unitPrice) }))
    : [
        {
          description: `Balance due against ${invoice.number}`,
          quantity: 1,
          unitPrice: Math.max(0, balance),
          taxRate: 0,
          amount: round2(Math.max(0, balance)),
        },
      ];
  const discount = useInvoiceItems ? invoice.discount : undefined;
  const totals = computeTotals(items, discount);
  const dueDate = invoice.dueDate ?? addDaysIso(today, 14);

  return {
    type: "request" as const,
    templateId: "request-payment",
    title: `Payment request — ${invoice.number}`,
    status: "draft" as const,
    contactId: contactHex(invoice.contactId),
    issueDate: today,
    dueDate,
    currency: invoice.currency,
    items,
    discount,
    ...totals,
    content: {
      subject: `Payment request — ${invoice.number}`,
      body: `Dear client,\n\nThis is a polite reminder that ${invoice.number} has an outstanding balance of ${totals.total.toFixed(2)} ${invoice.currency}, due on ${dueDate}.\n\nPlease arrange payment at your earliest convenience. If payment has already been sent, kindly disregard this notice.\n\nKind regards,`,
      terms: invoice.content.terms ?? "",
    },
    layout: invoice.layout,
    referenceNumber: invoice.number,
  };
}

/** Credit/debit note that mirrors an invoice's line items. */
export function notePayload(
  invoice: InvoiceLike,
  kind: "creditNote" | "debitNote",
  today = todayIsoDate(),
) {
  const items = invoice.items.map((i) => ({ ...i, amount: round2(i.quantity * i.unitPrice) }));
  const discount = invoice.discount;
  const totals = computeTotals(items, discount);
  const label = kind === "creditNote" ? "Credit note" : "Debit note";

  return {
    type: kind,
    templateId: kind === "creditNote" ? "credit-note-classic" : "debit-note-classic",
    title: `${label} against ${invoice.number}`,
    status: "draft" as const,
    contactId: contactHex(invoice.contactId),
    issueDate: today,
    dueDate: undefined as string | undefined,
    currency: invoice.currency,
    items,
    discount,
    ...totals,
    content: {
      subject: `${label} against ${invoice.number}`,
      body:
        kind === "creditNote"
          ? `This credit note adjusts ${invoice.number} for returned goods, cancelled work or an agreed discount. The balance reflects the amended amount.`
          : `This debit note records an additional charge against ${invoice.number} for extra work or re-issued quantities.`,
      terms: invoice.content.terms ?? "",
    },
    layout: invoice.layout,
    referenceNumber: invoice.number,
  };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
