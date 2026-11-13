"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/actions/products";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

export interface ProductRow {
  id: string;
  kind: "product" | "service";
  name: string;
  description?: string;
  sku?: string;
  unitPrice: number;
  unit?: string;
  taxRate: number;
  category?: string;
  image?: string;
  active: boolean;
}

const UNITS = ["unit", "hr", "day", "week", "month", "pcs", "kg", "km", "job"];

export function ProductDialog({
  product,
  currency = "USD",
  triggerLabel = "+ New product",
}: {
  product?: ProductRow;
  currency?: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [image, setImage] = useState<string | undefined>(product?.image);
  const fileRef = useRef<HTMLInputElement>(null);

  function onImage(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("Logo must be a PNG or JPEG image");
      return;
    }
    if (file.size > 700 * 1024) {
      setError("Image must be smaller than 700KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""]),
    );
    const input = {
      ...raw,
      unitPrice: Number(raw.unitPrice),
      taxRate: Number(raw.taxRate),
      active: fd.get("active") === "on",
      image,
    };
    setError(null);
    startTransition(async () => {
      const res = product
        ? await updateProduct(product.id, input)
        : await createProduct(input);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (!product || !confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteProduct(product.id);
      if (!res.ok) {
        setError(res.error ?? "Failed to delete");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          product
            ? "text-sm text-royal hover:underline"
            : "inline-flex h-10 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
        }
      >
        {product ? product.name : triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-white p-6">
            <h2 className="mb-4 font-display text-xl text-ink">
              {product ? "Edit product" : "New product or service"}
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    name="kind"
                    defaultValue={product?.kind ?? "product"}
                    required
                    className="h-9 w-full rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-royal focus:outline-none"
                  >
                    <option value="product">Product</option>
                    <option value="service">Service</option>
                  </select>
                </Field>
                <Field label="Status">
                  <label className="flex h-9 items-center gap-2 text-sm text-ink">
                    <input
                      name="active"
                      type="checkbox"
                      defaultChecked={product?.active ?? true}
                      className="size-4 accent-royal"
                    />
                    Active (visible in pickers)
                  </label>
                </Field>
                <Field label="Name" className="sm:col-span-2">
                  <Input
                    name="name"
                    required
                    defaultValue={product?.name ?? ""}
                    placeholder="Brand identity design"
                  />
                </Field>
                <Field label="SKU / service code">
                  <Input
                    name="sku"
                    defaultValue={product?.sku ?? ""}
                    placeholder="BRAND-01"
                    maxLength={40}
                  />
                </Field>
                <Field label="Category">
                  <Input
                    name="category"
                    defaultValue={product?.category ?? ""}
                    placeholder="Design, Retainers, …"
                    maxLength={60}
                  />
                </Field>
                <Field label={`Unit price (${currency})`}>
                  <Input
                    name="unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={product?.unitPrice ?? ""}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Unit of measurement">
                  <select
                    name="unit"
                    defaultValue={product?.unit ?? "unit"}
                    className="h-9 w-full rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-royal focus:outline-none"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tax %">
                  <Input
                    name="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    defaultValue={product?.taxRate ?? 0}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    name="description"
                    rows={2}
                    defaultValue={product?.description ?? ""}
                    placeholder="What's included…"
                  />
                </Field>
              </div>

              <Field label="Product image (optional, PNG/JPEG ≤ 700KB)">
                <div className="flex items-center gap-3">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      className="size-12 rounded-[3px] border border-line object-cover"
                    />
                  ) : null}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label="Product image"
                    onChange={(e) => onImage(e.target.files?.[0])}
                    className="text-xs text-muted file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:text-ink"
                  />
                  {image ? (
                    <button
                      type="button"
                      onClick={() => {
                        setImage(undefined);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                      aria-label="Remove image"
                      className="rounded p-1 text-muted hover:text-red"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </Field>

              {error ? (
                <p className="text-sm text-red" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {product ? (
                    <button
                      type="button"
                      onClick={remove}
                      className="text-sm text-red hover:underline"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Small read-only price label used in lists. */
export function ProductPrice({ value, currency }: { value: number; currency: string }) {
  return <span className="tabular-nums">{formatMoney(value, currency)}</span>;
}
