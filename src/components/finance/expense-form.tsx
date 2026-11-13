"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { createExpense, deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/finance";
import type { ExpenseInput } from "@/lib/validation/schemas";
import { todayIsoDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function ExpenseForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Receipt must be a PNG or JPEG");
      return;
    }
    if (file.size > 700 * 1024) {
      setError("Receipt must be under 700KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceipt(String(reader.result));
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createExpense({
        date: String(fd.get("date") ?? ""),
        category: String(fd.get("category") ?? "other") as ExpenseInput["category"],
        vendor: String(fd.get("vendor") ?? "") || undefined,
        description: String(fd.get("description") ?? ""),
        amount: Number(fd.get("amount") ?? 0),
        taxRate: Number(fd.get("taxRate") ?? 0),
        notes: String(fd.get("notes") ?? "") || undefined,
        receipt,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to add expense");
        return;
      }
      setFlash("Expense added");
      setReceipt(undefined);
      formRef.current?.reset();
      if (fileRef.current) fileRef.current.value = "";
      setTimeout(() => setFlash(null), 2500);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      {error ? (
        <p className="rounded-[3px] bg-red/10 px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date">
          <Input type="date" name="date" defaultValue={todayIsoDate()} required />
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue="other">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor">
          <Input name="vendor" placeholder="AWS, Uber, Staples…" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input name="description" required placeholder="What was this for?" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount (net)">
            <Input type="number" name="amount" min={0.01} step="0.01" required placeholder="0.00" />
          </Field>
          <Field label="Tax %">
            <Input type="number" name="taxRate" min={0} max={100} step="0.01" defaultValue={0} />
          </Field>
        </div>
        <Field label="Receipt" hint="PNG or JPEG, up to 700KB" className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-[3px] file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:text-ink"
            />
            {receipt ? (
              <button
                type="button"
                onClick={() => {
                  setReceipt(undefined);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="shrink-0 text-xs text-muted hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </Field>
        <Field label="Notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea name="notes" rows={2} placeholder="Optional — GSTIN of vendor, project code…" />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Add expense
        </Button>
        {flash ? <span className="text-sm text-forest">{flash}</span> : null}
      </div>
    </form>
  );
}

export function DeleteExpenseButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm("Delete this expense?")) return;
    start(async () => {
      const res = await deleteExpense(id);
      if (!res.ok) setError(res.error ?? "Failed to delete");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="Delete expense"
        className="rounded-[3px] p-1.5 text-muted hover:bg-paper hover:text-red disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
      {error ? <span className="ml-2 text-xs text-red">{error}</span> : null}
    </>
  );
}
