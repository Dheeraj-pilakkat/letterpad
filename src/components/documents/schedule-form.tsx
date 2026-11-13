"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchedule } from "@/lib/actions/schedules";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import { DOCUMENT_TYPES, TYPE_META, templatesForType } from "@/lib/templates/registry";
import { CURRENCIES } from "@/lib/constants";
import { RECURRENCE_INTERVALS, INTERVAL_LABELS, isDue } from "@/lib/recurring";
import { todayIsoDate } from "@/lib/utils";
import type { ContactOption } from "@/components/documents/document-editor";
import type { DocumentType, RecurrenceInterval } from "@/lib/db/types";

interface ScheduleItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export function ScheduleForm({ contacts }: { contacts: ContactOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<DocumentType>("invoice");
  const [templateId, setTemplateId] = useState("invoice-classic");
  const [items, setItems] = useState<ScheduleItem[]>([
    { description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
  ]);

  const templates = templatesForType(type);

  function onTypeChange(next: DocumentType) {
    setType(next);
    const first = templatesForType(next)[0];
    if (first) setTemplateId(first.id);
  }

  function updateItem(i: number, patch: Partial<ScheduleItem>) {
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unitPrice: 0, taxRate: 0 },
    ]);
  }

  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startDate = String(fd.get("startDate") || "");
    const endDate = String(fd.get("endDate") || "") || undefined;
    const interval = String(fd.get("interval") || "monthly") as RecurrenceInterval;
    const contactId = String(fd.get("contactId") || "") || undefined;
    const title = String(fd.get("title") || "") || undefined;
    const currency = String(fd.get("currency") || "USD");
    const taxRate = Number(fd.get("taxRate") || 0);

    const cleaned = items
      .filter((item) => item.description.trim())
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        taxRate: Number.isFinite(item.taxRate) ? item.taxRate : taxRate,
      }));

    if (!startDate) {
      setError("Start date is required");
      return;
    }
    if (cleaned.length === 0) {
      setError("Add at least one line item");
      return;
    }

    startTransition(async () => {
      setError(null);
      const res = await createSchedule({
        type,
        templateId,
        contactId,
        title,
        interval,
        startDate,
        endDate,
        currency,
        items: cleaned,
        content: {
          subject: String(fd.get("subject") || "") || undefined,
          body: String(fd.get("body") || "") || undefined,
        },
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to create schedule");
        return;
      }
      router.refresh();
    });
  }

  const exampleNext = isDue(todayIsoDate()) ? todayIsoDate() : todayIsoDate();

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-[4px] border border-line bg-white p-5">
      <h2 className="font-display text-lg text-ink">New recurring document</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Document type">
          <Select value={type} onChange={(e) => onTypeChange(e.target.value as DocumentType)}>
            {DOCUMENT_TYPES.filter((t) =>
              ["quote", "invoice", "request", "receipt"].includes(t),
            ).map((t) => (
              <option key={t} value={t}>
                {TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Template">
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact">
          <Select name="contactId" defaultValue="">
            <option value="">No contact</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.companyName ? ` · ${c.companyName}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <Input name="title" placeholder="Monthly retainer" />
        </Field>
        <Field label="Frequency">
          <Select name="interval" defaultValue="monthly">
            {RECURRENCE_INTERVALS.map((i) => (
              <option key={i} value={i}>
                {INTERVAL_LABELS[i]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue="USD">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First run date" hint="Drafts are created on or after this day">
          <Input name="startDate" type="date" required defaultValue={todayIsoDate()} />
        </Field>
        <Field label="End date (optional)">
          <Input name="endDate" type="date" />
        </Field>
        <Field label="Default tax %" hint="Used if line items leave tax at 0">
          <Input name="taxRate" type="number" min={0} max={100} step="0.01" defaultValue={0} />
        </Field>
        <Field label="Email subject">
          <Input name="subject" placeholder="Invoice for {month}" />
        </Field>
        <Field label="Body note" className="sm:col-span-2">
          <Textarea
            name="body"
            rows={2}
            placeholder="Thanks for your business — see the attached document."
          />
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium text-ink-soft">Line items</p>
        {items.map((item, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_80px_auto]">
            <Input
              value={item.description}
              onChange={(e) => updateItem(i, { description: e.target.value })}
              placeholder="Description"
              required
            />
            <Input
              type="number"
              min={0}
              step="any"
              value={item.quantity}
              onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
              placeholder="Qty"
              aria-label="Quantity"
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={item.unitPrice}
              onChange={(e) => updateItem(i, { unitPrice: Number(e.target.value) })}
              placeholder="Unit price"
              aria-label="Unit price"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={item.taxRate}
              onChange={(e) => updateItem(i, { taxRate: Number(e.target.value) })}
              placeholder="Tax %"
              aria-label="Tax percent"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(i)}
              disabled={items.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          + Add line
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null}
          Create schedule
        </Button>
        <span className="text-xs text-muted">
          First draft ready from {exampleNext} · {INTERVAL_LABELS.monthly.toLowerCase()} by default
        </span>
      </div>
    </form>
  );
}
