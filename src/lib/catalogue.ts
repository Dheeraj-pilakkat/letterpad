import type { Product } from "@/lib/db/types";
import { financeCsv } from "@/lib/finance";

/** Minimum shape the catalogue helpers need (lets tests use plain objects). */
export type ProductRow = Pick<
  Product,
  "name" | "kind" | "unitPrice" | "taxRate" | "active"
> & {
  sku?: string;
  unit?: string;
  category?: string;
};

/** Case-insensitive search across name, SKU and category. */
export function filterProducts<T extends ProductRow>(
  rows: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.name, row.sku ?? "", row.category ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

/** CSV rows for the catalogue export (stable column order). */
export function productCsvRows(rows: ProductRow[]): Array<Record<string, string | number>> {
  return rows.map((row) => ({
    Name: row.name,
    Type: row.kind,
    SKU: row.sku ?? "",
    "Unit price": row.unitPrice,
    "Tax %": row.taxRate,
    Unit: row.unit ?? "",
    Category: row.category ?? "",
    Status: row.active ? "active" : "inactive",
  }));
}

/** RFC-4180 CSV for the catalogue (reuses the finance CSV escaper). */
export function productsCsv(rows: ProductRow[]): string {
  return financeCsv(productCsvRows(rows));
}
