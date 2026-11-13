import { describe, expect, it } from "vitest";
import {
  balanceOf,
  expenseCalc,
  financeCsv,
  gstTotalRows,
  monthlySeries,
  notePayload,
  paymentRequestPayload,
  resolveGst,
  statusAfterPayment,
  statusAfterPaymentRemoval,
  summarizeFinance,
  sumPayments,
} from "@/lib/finance";
import type { GstSplit, TemplateLayout } from "@/lib/db/types";

const pay = (amount: number, refunded = false) => ({ amount, refunded });

describe("payments ledger", () => {
  it("sums only non-refunded payments", () => {
    expect(sumPayments([pay(100), pay(50), pay(20, true)])).toBe(150);
    expect(sumPayments([])).toBe(0);
  });

  it("balance never goes negative", () => {
    expect(balanceOf(100, [pay(80)])).toBe(20);
    expect(balanceOf(100, [pay(100)])).toBe(0);
    expect(balanceOf(100, [pay(150)])).toBe(0);
  });

  it("rounds to two decimals", () => {
    expect(sumPayments([pay(0.1), pay(0.2)])).toBe(0.3);
  });
});

describe("status transitions from payments", () => {
  it("stays put while a balance remains", () => {
    expect(statusAfterPayment(100, [pay(60)], "sent")).toBe("sent");
    expect(statusAfterPayment(100, [pay(60)], "overdue")).toBe("overdue");
  });

  it("flips to paid when fully covered", () => {
    expect(statusAfterPayment(100, [pay(40), pay(60)], "sent")).toBe("paid");
    // floating point dust still counts as covered
    expect(statusAfterPayment(100, [pay(99.999)], "sent")).toBe("paid");
  });

  it("ignores refunded payments", () => {
    expect(statusAfterPayment(100, [pay(100, true)], "sent")).toBe("sent");
  });

  it("zero-total documents keep their status", () => {
    expect(statusAfterPayment(0, [], "draft")).toBe("draft");
  });

  it("removing a payment falls back to overdue or sent", () => {
    const today = "2026-06-15";
    expect(statusAfterPaymentRemoval([pay(50)], 100, "2026-06-01", today)).toBe("overdue");
    expect(statusAfterPaymentRemoval([pay(50)], 100, "2026-07-01", today)).toBe("sent");
    expect(statusAfterPaymentRemoval([pay(50)], 100, undefined, today)).toBe("sent");
    expect(statusAfterPaymentRemoval([pay(100)], 100, undefined, today)).toBe("paid");
  });
});

describe("GST split", () => {
  const base = { enabled: true, taxTotal: 180, placeOfSupply: "Karnataka" };

  it("splits intra-state tax into CGST + SGST", () => {
    const gst = resolveGst({
      ...base,
      workspaceState: "Karnataka",
      workspaceCountry: "India",
      contactState: "Karnataka",
      contactCountry: "India",
    });
    expect(gst).toEqual({ placeOfSupply: "Karnataka", cgst: 90, sgst: 90, igst: 0 });
  });

  it("uses IGST for inter-state", () => {
    const gst = resolveGst({
      ...base,
      workspaceState: "Karnataka",
      workspaceCountry: "India",
      contactState: "Maharashtra",
      contactCountry: "India",
    });
    expect(gst).toEqual({ placeOfSupply: "Karnataka", cgst: 0, sgst: 0, igst: 180 });
  });

  it("uses IGST when the contact country differs", () => {
    const gst = resolveGst({
      ...base,
      workspaceState: "Karnataka",
      workspaceCountry: "India",
      contactState: "Karnataka",
      contactCountry: "Singapore",
    });
    expect(gst?.igst).toBe(180);
  });

  it("odd totals split without losing a cent", () => {
    const gst = resolveGst({
      ...base,
      taxTotal: 100.01,
      workspaceState: "Karnataka",
      workspaceCountry: "India",
      contactState: "Karnataka",
      contactCountry: "India",
    });
    expect(round(gst!.cgst + gst!.sgst)).toBe(100.01);
    expect(gst!.cgst).toBe(50.01);
    expect(gst!.sgst).toBe(50);
  });

  it("returns undefined when disabled or no tax", () => {
    expect(resolveGst({ ...base, enabled: false })).toBeUndefined();
    expect(resolveGst({ ...base, taxTotal: 0 })).toBeUndefined();
  });

  it("falls back to the workspace state for place of supply", () => {
    const gst = resolveGst({
      enabled: true,
      taxTotal: 10,
      workspaceState: "Goa",
      workspaceCountry: "India",
      contactState: "Goa",
      contactCountry: "India",
    });
    expect(gst?.placeOfSupply).toBe("Goa");
    expect(gst?.cgst).toBe(5);
  });

  it("gstTotalRows renders CGST/SGST or a single IGST row", () => {
    const intra: GstSplit = { placeOfSupply: "Karnataka", cgst: 90, sgst: 90, igst: 0 };
    expect(gstTotalRows(intra, 180)).toEqual([
      { label: "CGST", amount: 90 },
      { label: "SGST", amount: 90 },
    ]);
    const inter: GstSplit = { placeOfSupply: "Karnataka", cgst: 0, sgst: 0, igst: 180 };
    expect(gstTotalRows(inter, 180)).toEqual([{ label: "IGST", amount: 180 }]);
    expect(gstTotalRows(intra, 0)).toEqual([]);
    expect(gstTotalRows(undefined, 180)).toEqual([]);
  });
});

describe("expense math", () => {
  it("adds tax on top of the net amount", () => {
    expect(expenseCalc(100, 18)).toEqual({ taxAmount: 18, total: 118 });
    expect(expenseCalc(99.99, 9)).toEqual({ taxAmount: 9, total: 108.99 });
  });

  it("clamps negatives and zero tax", () => {
    expect(expenseCalc(-5, 18)).toEqual({ taxAmount: 0, total: 0 });
    expect(expenseCalc(50, 0)).toEqual({ taxAmount: 0, total: 50 });
  });
});

describe("finance summary", () => {
  it("aggregates invoiced, received, outstanding and taxes", () => {
    const s = summarizeFinance({
      invoices: [
        { total: 1000, taxTotal: 180 },
        { total: 500, taxTotal: 90 },
      ],
      payments: [pay(600), pay(100, true)],
      expenses: [
        { total: 200, taxAmount: 36 },
        { total: 50, taxAmount: 0 },
      ],
    });
    expect(s.invoiced).toBe(1500);
    expect(s.received).toBe(600);
    expect(s.outstanding).toBe(900);
    expect(s.expenses).toBe(250);
    expect(s.netIncome).toBe(350);
    expect(s.taxCollected).toBe(270);
    expect(s.taxOnExpenses).toBe(36);
    expect(s.taxPayable).toBe(234);
  });

  it("outstanding and tax payable never go negative", () => {
    const s = summarizeFinance({
      invoices: [{ total: 100 }],
      payments: [pay(500)],
      expenses: [{ total: 10, taxAmount: 999 }],
    });
    expect(s.outstanding).toBe(0);
    expect(s.taxPayable).toBe(0);
  });
});

describe("monthly series", () => {
  it("returns six months ending today, sorted, with empty buckets", () => {
    const points = monthlySeries({
      payments: [{ date: "2026-05-10", amount: 100 }],
      expenses: [{ date: "2026-06-02", total: 40 }],
      today: "2026-06-15",
    });
    expect(points).toHaveLength(6);
    expect(points[5]).toEqual({ month: "2026-06", income: 0, expense: 40 });
    expect(points[4]).toEqual({ month: "2026-05", income: 100, expense: 0 });
    expect(points[0].month).toBe("2026-01");
    const months = points.map((p) => p.month);
    expect([...months].sort()).toEqual(months);
  });

  it("skips refunded payments and out-of-range dates", () => {
    const points = monthlySeries({
      payments: [
        { date: "2026-06-01", amount: 50, refunded: true },
        { date: "2025-01-01", amount: 999 },
      ],
      expenses: [{ date: "2026-06-05", total: 10 }],
      today: "2026-06-15",
      months: 3,
    });
    expect(points).toHaveLength(3);
    expect(points[2].income).toBe(0);
    expect(points[2].expense).toBe(10);
    expect(points.every((p) => p.income === 0)).toBe(true);
  });
});

describe("financeCsv", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = financeCsv([
      { name: "Acme, Inc", note: 'said "hi"', line: "a\nb" },
      { name: "Plain", note: "ok", line: "x" },
    ]);
    expect(csv).toBe('name,note,line\n"Acme, Inc","said ""hi""","a\nb"\nPlain,ok,x');
  });

  it("returns an empty string for no rows", () => {
    expect(financeCsv([])).toBe("");
  });
});

describe("payment request payload", () => {
  const invoice = {
    number: "INV-0042",
    type: "invoice" as const,
    total: 1180,
    currency: "INR",
    issueDate: "2026-06-01",
    dueDate: "2026-06-20",
    contactId: { toHexString: () => "665f1c2e8b1e2a0001020304" },
    items: [
      { description: "Design", quantity: 2, unitPrice: 500, taxRate: 18 },
    ],
    discount: undefined,
    content: { subject: "June work", body: "body", terms: "Net 14" },
    layout: {} as TemplateLayout,
  };

  it("mirrors invoice items when fully unpaid", () => {
    const p = paymentRequestPayload(invoice, 1180, "2026-06-15");
    expect(p.type).toBe("request");
    expect(p.templateId).toBe("request-payment");
    expect(p.referenceNumber).toBe("INV-0042");
    expect(p.items).toHaveLength(1);
    expect(p.items[0].description).toBe("Design");
    expect(p.dueDate).toBe("2026-06-20");
    expect(p.title).toContain("INV-0042");
  });

  it("asks for the remaining balance after partial payment", () => {
    const p = paymentRequestPayload(invoice, 500, "2026-06-15");
    expect(p.items).toHaveLength(1);
    expect(p.items[0].description).toBe("Balance due against INV-0042");
    expect(p.items[0].unitPrice).toBe(500);
    expect(p.total).toBe(500);
    expect(p.discount).toBeUndefined();
  });

  it("defaults the due date to 14 days out when the invoice has none", () => {
    const p = paymentRequestPayload({ ...invoice, dueDate: undefined }, 1180, "2026-06-15");
    expect(p.dueDate).toBe("2026-06-29");
  });
});

describe("credit / debit note payload", () => {
  const invoice = {
    number: "INV-0009",
    type: "invoice" as const,
    total: 590,
    currency: "USD",
    issueDate: "2026-05-01",
    contactId: "665f1c2e8b1e2a0001020304",
    items: [
      { description: "Widget", quantity: 1, unitPrice: 500, taxRate: 18 },
    ],
    discount: { type: "percent" as const, value: 10 },
    content: { terms: "Net 7" },
    layout: {} as TemplateLayout,
  };

  it("mirrors items, discount and totals; references the invoice", () => {
    const p = notePayload(invoice, "creditNote", "2026-06-15");
    expect(p.type).toBe("creditNote");
    expect(p.templateId).toBe("credit-note-classic");
    expect(p.referenceNumber).toBe("INV-0009");
    expect(p.items).toHaveLength(1);
    expect(p.items[0].amount).toBe(500);
    expect(p.discount).toEqual({ type: "percent", value: 10 });
    expect(p.subtotal).toBe(500);
    expect(p.total).toBe(p.subtotal - p.discountTotal + p.taxTotal);
    expect(p.dueDate).toBeUndefined();
    expect(p.title).toContain("Credit note");
  });

  it("debit notes use their own template and copy", () => {
    const p = notePayload(invoice, "debitNote");
    expect(p.type).toBe("debitNote");
    expect(p.templateId).toBe("debit-note-classic");
    expect(p.content.body).toContain("additional charge");
    expect(p.content.subject).toContain("INV-0009");
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
