import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { filterProducts, productCsvRows } from "@/lib/catalogue";
import { ProductDialog } from "@/components/products/product-dialog";
import { ExportCsvButton } from "@/components/finance/export-csv-button";
import { EmptyState } from "@/components/ui/card";
import { cn, formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Products & services" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { q, view } = await searchParams;
  const showInactive = view === "inactive";

  const filter: Record<string, unknown> = {
    workspaceId: workspace._id,
    active: !showInactive,
  };
  if (q?.trim()) {
    const re = { $regex: q.trim(), $options: "i" };
    filter.$or = [{ name: re }, { sku: re }, { category: re }];
  }

  const products = await collections
    .products()
    .find(filter)
    .sort({ name: 1 })
    .limit(300)
    .toArray();

  // export always covers the full catalogue (both statuses), filtered by search
  const allForExport = filterProducts(
    await collections
      .products()
      .find({ workspaceId: workspace._id })
      .sort({ name: 1 })
      .limit(1000)
      .toArray(),
    q ?? "",
  );

  function hrefWith(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { q, view, ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/app/products?${s}` : "/app/products";
  }

  const currency = workspace.currency ?? "USD";

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Products &amp; services</h1>
          <p className="mt-1 text-sm text-muted">
            Reusable catalogue items — pick them while writing an invoice or quotation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            rows={productCsvRows(allForExport)}
            filename={`letterpad-catalogue-${new Date().toISOString().slice(0, 10)}.csv`}
          />
          <ProductDialog currency={currency} />
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a
          href={hrefWith({ view: undefined })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            !showInactive
              ? "border-ink bg-ink text-paper"
              : "border-line bg-white text-muted hover:border-ink/40",
          )}
        >
          Active
        </a>
        <a
          href={hrefWith({ view: "inactive" })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            showInactive
              ? "border-ink bg-ink text-paper"
              : "border-line bg-white text-muted hover:border-ink/40",
          )}
        >
          Inactive
        </a>
        <form className="ml-auto w-full sm:w-auto" action="/app/products" method="get">
          {showInactive ? <input type="hidden" name="view" value="inactive" /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, SKU, category…"
            className="h-9 w-full rounded-[3px] border border-line bg-white px-3 text-xs text-ink placeholder:text-muted/60 focus:border-royal focus:outline-none sm:w-64"
          />
        </form>
      </div>

      {products.length === 0 ? (
        <EmptyState
          title={
            showInactive
              ? "No inactive items"
              : q
                ? "No matches"
                : "No products yet"
          }
          description={
            showInactive
              ? "Deactivated items appear here — reactivate one to use it in pickers again."
              : q
                ? "Try a different search."
                : "Add the products and services you sell, then drop them straight into documents."
          }
          action={
            !showInactive && !q ? (
              <ProductDialog currency={currency} triggerLabel="+ Add your first product" />
            ) : (
              <a
                href={hrefWith({ q: undefined, view: undefined })}
                className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink"
              >
                Clear filters
              </a>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Tax</th>
                <th className="px-4 py-2.5 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id.toHexString()} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3">
                    <ProductDialog
                      currency={currency}
                      product={{
                        id: p._id.toHexString(),
                        kind: p.kind,
                        name: p.name,
                        description: p.description,
                        sku: p.sku,
                        unitPrice: p.unitPrice,
                        unit: p.unit,
                        taxRate: p.taxRate,
                        category: p.category,
                        image: p.image,
                        active: p.active,
                      }}
                    />
                    <p className="truncate text-xs text-muted">
                      {p.kind === "service" ? "Service" : "Product"}
                      {p.description ? ` · ${p.description}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs tabular-nums text-muted">{p.sku ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink">
                    {formatMoney(p.unitPrice, currency)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">{p.taxRate}%</td>
                  <td className="px-4 py-3 text-xs text-muted">{p.unit ?? "unit"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
