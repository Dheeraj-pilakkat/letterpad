import { describe, expect, it } from "vitest";
import { round2 } from "@/lib/utils";
import { computeTotals, lineAmount } from "@/lib/validation/schemas";

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
    // tax must never be baked into the line amount
    expect(lineAmount({ quantity: 2, unitPrice: 100 })).toBe(200);
  });

  it("handles fractional quantities", () => {
    expect(lineAmount({ quantity: 0.5, unitPrice: 80 })).toBe(40);
    expect(round2(0.1 * 0.2)).toBe(0.02);
  });
});

describe("computeTotals", () => {
  it("returns zeros for no items", () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, taxTotal: 0, total: 0 });
  });

  it("sums net line amounts as subtotal", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 1, unitPrice: 45000, taxRate: 18 },
      { quantity: 1, unitPrice: 18000, taxRate: 18 },
    ]);
    expect(subtotal).toBe(63000);
    expect(taxTotal).toBe(11340);
    expect(total).toBe(74340);
  });

  it("computes tax per line and rounds each", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 7, unitPrice: 33.33, taxRate: 10 },
    ]);
    expect(subtotal).toBe(233.31); // 233.31
    expect(taxTotal).toBe(23.33); // 23.331 → 23.33
    expect(total).toBe(256.64);
  });

  it("handles mixed tax rates including zero", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 1, unitPrice: 100, taxRate: 0 },
      { quantity: 1, unitPrice: 200, taxRate: 18 },
      { quantity: 2, unitPrice: 50, taxRate: 5 },
    ]);
    expect(subtotal).toBe(400);
    expect(taxTotal).toBe(36 + 5); // 41
    expect(total).toBe(441);
  });

  it("always keeps total = subtotal + taxTotal after rounding", () => {
    const { subtotal, taxTotal, total } = computeTotals([
      { quantity: 3, unitPrice: 19.99, taxRate: 17.5 },
      { quantity: 1, unitPrice: 0.1, taxRate: 12.5 },
    ]);
    expect(total).toBe(round2(subtotal + taxTotal));
  });
});
