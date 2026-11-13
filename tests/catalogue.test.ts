import { describe, expect, it } from "vitest";
import { filterProducts, productCsvRows, productsCsv } from "@/lib/catalogue";

const rows = [
  { name: "Brand identity", kind: "service" as const, unitPrice: 500, taxRate: 18, active: true, sku: "BRAND-01", category: "Design" },
  { name: "Logo pack", kind: "product" as const, unitPrice: 120, taxRate: 12, active: true },
  { name: "Retainer", kind: "service" as const, unitPrice: 2000, taxRate: 0, active: false, category: "Monthly" },
];

describe("filterProducts", () => {
  it("returns everything for a blank query", () => {
    expect(filterProducts(rows, "")).toHaveLength(3);
    expect(filterProducts(rows, "   ")).toHaveLength(3);
  });

  it("matches name case-insensitively", () => {
    expect(filterProducts(rows, "brand").map((r) => r.name)).toEqual(["Brand identity"]);
    expect(filterProducts(rows, "LOGO").map((r) => r.name)).toEqual(["Logo pack"]);
  });

  it("matches SKU and category", () => {
    expect(filterProducts(rows, "brand-01")).toHaveLength(1);
    expect(filterProducts(rows, "monthly")).toHaveLength(1);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterProducts(rows, "zzz")).toHaveLength(0);
  });
});

describe("productCsvRows", () => {
  it("emits stable columns with defaults for optional fields", () => {
    const [first, second] = productCsvRows(rows);
    expect(Object.keys(first)).toEqual([
      "Name",
      "Type",
      "SKU",
      "Unit price",
      "Tax %",
      "Unit",
      "Category",
      "Status",
    ]);
    expect(first.SKU).toBe("BRAND-01");
    expect(second.SKU).toBe("");
    expect(first.Status).toBe("active");
    expect(productCsvRows(rows)[2].Status).toBe("inactive");
  });
});

describe("productsCsv", () => {
  it("produces a header row plus one row per product", () => {
    const csv = productsCsv(rows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0].startsWith("Name,Type,SKU")).toBe(true);
  });

  it("escapes quotes and commas", () => {
    const csv = productsCsv([
      { name: 'We "quote", often', kind: "product", unitPrice: 1, taxRate: 0, active: true },
    ]);
    expect(csv).toContain('"We ""quote"", often"');
  });

  it("returns empty string for no rows", () => {
    expect(productsCsv([])).toBe("");
  });
});
