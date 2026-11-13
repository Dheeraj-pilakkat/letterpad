"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import {
  createNoteAction,
  createPaymentRequestAction,
} from "@/lib/actions/finance";
import { deletePaymentAction, recordPaymentAction } from "@/lib/actions/payments";
import { sendPaymentReminderAction } from "@/lib/actions/sharing";
import { PAYMENT_METHODS, balanceOf, sumPayments } from "@/lib/finance";
import type { PaymentInput } from "@/lib/validation/schemas";
import type { DocumentStatus, DocumentType, PaymentMethod } from "@/lib/db/types";
import type { PaymentDTO } from "@/lib/serialize";
import { formatMoney, todayIsoDate } from "@/lib/utils";
import { PayNowButton } from "@/components/finance/pay-now-button";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

const PAYABLE_TYPES: DocumentType[] = ["invoice", "quote", "request"];

export function PaymentsPanel({
  docId,
  docNumber,
  docType,
  total,
  currency,
  status,
  payments,
  razorpayKeyId,
  contactEmail,
}: {
  docId: string;
  docNumber: string;
  docType: DocumentType;
  total: number;
  currency: string;
  status: DocumentStatus;
  payments: PaymentDTO[];
  razorpayKeyId?: string | null;
  contactEmail?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const payable = PAYABLE_TYPES.includes(docType);
  const paid = sumPayments(payments);
  const balance = balanceOf(total, payments);

  function record(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    const fd = new FormData(e.currentTarget);
    const input: PaymentInput = {
      amount: Number(fd.get("amount") ?? 0),
      date: String(fd.get("date") ?? ""),
      method: String(fd.get("method") ?? "bank") as PaymentMethod,
      reference: String(fd.get("reference") ?? "") || undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
    };
    start(async () => {
      const res = await recordPaymentAction(docId, input);
      if (!res.ok) {
        setError(res.error ?? "Failed to record payment");
        return;
      }
      setFlash(`Payment recorded — ${formatMoney(input.amount, currency)}`);
      formRef.current?.reset();
      setTimeout(() => setFlash(null), 3000);
      router.refresh();
    });
  }

  function removePayment(id: string) {
    if (!confirm("Remove this payment? The document status will be recalculated.")) return;
    setError(null);
    start(async () => {
      const res = await deletePaymentAction(id);
      if (!res.ok) setError(res.error ?? "Failed to remove payment");
      else router.refresh();
    });
  }

  function sendReminder() {
    setError(null);
    setFlash(null);
    start(async () => {
      const res = await sendPaymentReminderAction(docId);
      if (!res.ok) {
        setError(res.error ?? "Failed to send reminder");
        return;
      }
      if (res.mode === "mailto" && res.mailto) {
        window.location.href = res.mailto;
        setFlash("Reminder draft opened in your email app");
      } else {
        setFlash("Payment reminder sent");
      }
      setTimeout(() => setFlash(null), 3000);
      router.refresh();
    });
  }

  function runAction(fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, message: string) {
    setError(null);
    setFlash(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Action failed");
        return;
      }
      setFlash(message);
      if (res.id) router.push(`/app/documents/${res.id}`);
      else router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-[4px] border border-line bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">Payments</h2>
        <span className="text-xs text-muted">
          Paid <span className="tabular-nums text-ink">{formatMoney(paid, currency)}</span> of{" "}
          <span className="tabular-nums text-ink">{formatMoney(total, currency)}</span>
          {balance > 0 ? (
            <>
              {" "}
              · <span className="tabular-nums text-amber-ink">{formatMoney(balance, currency)}</span>{" "}
              due
            </>
          ) : (
            <> · fully paid</>
          )}
        </span>
      </div>

      {error ? (
        <p className="rounded-[3px] bg-red/10 px-3 py-2 text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="rounded-[3px] bg-forest/10 px-3 py-2 text-xs text-forest" role="status">
          {flash}
        </p>
      ) : null}

      {payable ? (
        <form ref={formRef} onSubmit={record} className="grid grid-cols-2 gap-3 border-b border-line pb-4">
          <Field label="Amount">
            <Input
              type="number"
              name="amount"
              min={0.01}
              step="0.01"
              max={balance || undefined}
              defaultValue={balance > 0 ? balance : undefined}
              required
              placeholder="0.00"
            />
          </Field>
          <Field label="Date">
            <Input type="date" name="date" defaultValue={todayIsoDate()} required />
          </Field>
          <Field label="Method">
            <Select name="method" defaultValue="bank">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" hint="UTR, cheque no., transaction id">
            <Input name="reference" placeholder="Optional" />
          </Field>
          <div className="col-span-2 flex items-center justify-between gap-3">
            <Input
              name="notes"
              placeholder="Note (optional)"
              className="max-w-64"
            />
            <Button type="submit" size="sm" disabled={pending || balance <= 0}>
              {pending ? <Spinner /> : null}
              {balance <= 0 ? "Fully paid" : "Record payment"}
            </Button>
          </div>
        </form>
      ) : null}

      {payable && balance > 0 ? (
        <div className="border-b border-line pb-4">
          {razorpayKeyId ? (
            <div className="mb-3">
              <PayNowButton
                documentId={docId}
                keyId={razorpayKeyId}
                balance={balance}
                currency={currency}
                docNumber={docNumber}
              />
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !contactEmail}
            onClick={sendReminder}
            title={
              contactEmail
                ? `Email a payment reminder to ${contactEmail}`
                : "Add an email to the client first"
            }
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Send payment reminder
          </Button>
          {!contactEmail ? (
            <p className="mt-1.5 text-[11px] text-muted">
              The client needs an email address to receive reminders.
            </p>
          ) : null}
        </div>
      ) : null}

      {payments.length > 0 ? (
        <ul className="divide-y divide-line/70">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate text-ink">
                  <span className={`tabular-nums ${p.refunded ? "text-red line-through" : ""}`}>
                    {formatMoney(p.amount, currency)}
                  </span>
                  <span className="ml-2 text-muted">
                    {p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  {new Date(`${p.date}T00:00:00`).toLocaleDateString("en-GB")}
                  {p.refunded ? " · refunded" : ""}
                  {p.notes ? ` · ${p.notes}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removePayment(p.id)}
                disabled={pending}
                aria-label="Remove payment"
                className="rounded-[3px] p-1.5 text-muted hover:bg-paper hover:text-red disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">No payments recorded yet.</p>
      )}

      {docType === "invoice" ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || balance <= 0}
            onClick={() =>
              runAction(
                () => createPaymentRequestAction(docId),
                "Payment request created",
              )
            }
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Request payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              runAction(
                () => createNoteAction(docId, "creditNote"),
                "Credit note issued",
              )
            }
          >
            Issue credit note
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              runAction(
                () => createNoteAction(docId, "debitNote"),
                "Debit note issued",
              )
            }
          >
            Issue debit note
          </Button>
        </div>
      ) : null}

      {status === "paid" && docType === "invoice" ? (
        <p className="text-xs text-muted">
          {docNumber} is fully paid. Issue a credit note if you need to refund or correct the
          amount.
        </p>
      ) : null}
    </section>
  );
}
