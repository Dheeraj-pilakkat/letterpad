"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2 } from "lucide-react";
import {
  remindAllOverdueAction,
  sendPaymentReminderAction,
} from "@/lib/actions/sharing";

/** Sends a payment reminder for one document from the finance dashboard. */
export function ReminderButton({
  documentId,
  compact = false,
}: {
  documentId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function remind() {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await sendPaymentReminderAction(documentId);
      if (!res.ok) {
        setError(res.error ?? "Failed to send reminder");
        setTimeout(() => setError(null), 4000);
        return;
      }
      if (res.mode === "mailto" && res.mailto) {
        window.location.href = res.mailto;
        setMessage("Draft opened");
      } else {
        setMessage("Sent");
      }
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    });
  }

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={remind}
          disabled={pending}
          title={error ?? "Email a payment reminder"}
          className="rounded-[3px] p-1.5 text-muted hover:bg-paper hover:text-royal disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <BellRing size={14} />
          )}
        </button>
        {error ? (
          <span className="text-[11px] text-red" role="alert">
            {error}
          </span>
        ) : message ? (
          <span className="text-[11px] text-forest">{message}</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remind}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line bg-white px-4 text-sm font-medium text-ink hover:border-ink/40 disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        Remind overdue
      </button>
      {error ? <span className="text-xs text-red">{error}</span> : null}
      {message ? <span className="text-xs text-forest">{message}</span> : null}
    </span>
  );
}

/** Sends reminders for every overdue invoice with a balance (capped at 25). */
export function RemindAllButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function remindAll() {
    setMessage(null);
    start(async () => {
      const res = await remindAllOverdueAction();
      if (!res.ok) {
        setMessage(res.error ?? "Failed to send reminders");
      } else {
        const sent = res.sent ?? 0;
        const skipped = res.skipped ?? 0;
        setMessage(
          sent === 0 && skipped === 0
            ? "Nothing overdue"
            : `${sent} sent${skipped ? `, ${skipped} skipped` : ""}`,
        );
      }
      setTimeout(() => setMessage(null), 4000);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remindAll}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line bg-white px-4 text-sm font-medium text-ink hover:border-ink/40 disabled:opacity-50"
      >
        {pending ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        Remind all overdue
      </button>
      {message ? <span className="text-xs text-muted">{message}</span> : null}
    </span>
  );
}
