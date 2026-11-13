import { describe, expect, it } from "vitest";
import { round2 } from "@/lib/utils";
import { computeDiscount, computeTotals, lineAmount } from "@/lib/validation/schemas";

describe("round2", () => {
  it("rounds floating point noise to 2 decimals", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(19.999)).toBe(20);
    expect(round2(2.5)).toBe(2.5);
    expect(round2(1 / 3)).toBe(0.33);
    expect(round2(0)).toBe(0);
  });
});

describe("lineAmount", () => {
  it("computes quantity × unit price", () => {
    expect(lineAmount({ quantity: 3, unitPrice: 49.99 })).toBe(149.97);
    expect(lineAmount({ quantity: 1, unitPrice: 45000 })).toBe(45000);
  });

  it("is net of tax", () => {
    expect(lineAmount({ quantity: 2, unitPrice: 100 })).toBe(200);
  });

  it("handles fractional quantities", () => {
    expect(lineAmount({ quantity: 0.5, unitPrice: 80 })).toBe(40);
    expect(round2(0.1 * 0.2)).toBe(0.02);
  });
});

describe("computeDiscount", () => {
  it("returns 0 without a discount", () => {
    expect(computeDiscount(100)).toBe(0);
    expect(computeDiscount(100, null)).toBe(0);
    expect(computeDiscount(100, { type: "percent", value: 0 })).toBe(0);
  });

  it("applies percent discount", () => {
    expect(computeDiscount(200, { type: "percent", value: 10 })).toBe(20);
    expect(computeDiscount(200, { type: "percent", value: 100 })).toBe(200);
  });

  it("applies amount discount and clamps to subtotal", () => {
    expect(computeDiscount(200, { type: "amount", value: 50 })).toBe(50);
    expect(computeDiscount(200, { type: "amount", value: 500 })).toBe(200);
  });

  it("ignores discount when subtotal is 0", () => {
    expect(computeDiscount(0, { type: "percent", value: 10 })).toBe(0);
  });
});

describe("computeTotals", () => {
  it("returns zeros for no items", () => {
    expect(computeTotals([])).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });

  it("sums net line amounts as subtotal", () => {
    const { subtotal, discountTotal, taxTotal, total } = computeTotals([
      { quantity: 1, unitPrice: 45000, taxRate: 18 },
      { quantity: 1, unitPrice: 18000, taxRate: 18 },
    ]);
    expect(subtotal).toBe(63000);
    expect(discountTotal).toBe(0);
    expect(taxTotal).toBe(11340);
    expect(total).toBe(74340);
  });

  it("computes tax per line and rounds each", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 7, unitPrice: 33.33, taxRate: 10 },
    ]);
    expect(subtotal).toBe(233.31);
    expect(taxTotal).toBe(23.33);
    expect(total).toBe(256.64);
  });

  it("handles mixed tax rates including zero", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 1, unitPrice: 100, taxRate: 0 },
      { quantity: 1, unitPrice: 200, taxRate: 18 },
      { quantity: 2, unitPrice: 50, taxRate: 5 },
    ]);
    expect(subtotal).toBe(400);
    expect(taxTotal).toBe(41);
    expect(total).toBe(441);
  });

  it("always keeps total = subtotal − discount + taxTotal after rounding", () => {
    const { subtotal, discountTotal, taxTotal, total } = computeTotals([
      { quantity: 3, unitPrice: 19.99, taxRate: 17.5 },
      { quantity: 1, unitPrice: 0.1, taxRate: 12.5 },
    ]);
    expect(total).toBe(round2(subtotal - discountTotal + taxTotal));
  });

  it("applies percent discount and scales tax with the net base", () => {
    // subtotal 200, tax 10% = 20, 10% off → net 180, tax 18, total 198
    const totals = computeTotals(
      [{ quantity: 1, unitPrice: 200, taxRate: 10 }],
      { type: "percent", value: 10 },
    );
    expect(totals.subtotal).toBe(200);
    expect(totals.discountTotal).toBe(20);
    expect(totals.taxTotal).toBe(18);
    expect(totals.total).toBe(198);
  });

  it("applies amount discount", () => {
    // subtotal 150, tax 18% = 27, ₹50 off → net 100, tax 18, total 118
    const totals = computeTotals(
      [{ quantity: 1, unitPrice: 150, taxRate: 18 }],
      { type: "amount", value: 50 },
    );
    expect(totals.discountTotal).toBe(50);
    expect(totals.taxTotal).toBe(18);
    expect(totals.total).toBe(118);
  });

  it("never lets discount exceed subtotal", () => {
    const totals = computeTotals(
      [{ quantity: 1, unitPrice: 40, taxRate: 0 }],
      { type: "amount", value: 100 },
    );
    expect(totals.discountTotal).toBe(40);
    expect(totals.total).toBe(0);
  });
});
