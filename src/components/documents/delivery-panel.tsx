"use client";

import { useState, useTransition } from "react";
import { Clock, X, Check } from "lucide-react";
import {
  scheduleDeliveryAction,
  cancelDeliveryAction,
} from "@/lib/actions/deliveries";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export interface DeliveryDTO {
  id: string;
  sendAt: string;
  to: string;
  status: string;
  error?: string;
}

/** §15 scheduled document delivery — queue an email for a future time. */
export function DeliveryPanel({
  docId,
  defaultTo,
  deliveries,
}: {
  docId: string;
  defaultTo?: string;
  deliveries: DeliveryDTO[];
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [to, setTo] = useState(defaultTo ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function schedule(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !time) {
      setError("Pick a date and time");
      return;
    }
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await scheduleDeliveryAction({
        documentId: docId,
        sendAt: new Date(`${date}T${time}`).toISOString(),
        to: to.trim(),
        message: message.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to schedule");
        return;
      }
      setNotice(`Scheduled for ${date} ${time}`);
      setMessage("");
      setOpen(false);
    });
  }

  function cancel(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await cancelDeliveryAction(id);
      if (!res.ok) setError(res.error ?? "Failed to cancel");
    });
  }

  const pendingOnes = deliveries.filter((d) => d.status === "pending");
  const history = deliveries.filter((d) => d.status !== "pending");

  return (
    <section className="rounded-[4px] border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Clock size={14} className="text-royal" /> Scheduled delivery
        </h2>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Schedule send"}
        </Button>
      </div>

      {pendingOnes.length === 0 && !open && !notice ? (
        <p className="mt-2 text-xs text-muted">
          Queue this document to be emailed automatically at a future time —
          delivered by the cron job even when you&apos;re offline.
        </p>
      ) : null}

      {notice ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-forest" role="status">
          <Check size={12} /> {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <form onSubmit={schedule} className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Date">
              <Input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Send to">
            <Input
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="client@example.com"
            />
          </Field>
          <Field label="Message" hint="Optional — a secure view link is appended automatically">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="As promised, here is the invoice for March."
            />
          </Field>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Spinner /> : <Clock size={14} />} Schedule delivery
          </Button>
          <p className="text-xs text-muted">
            Requires RESEND_API_KEY for hands-off delivery; the cron job sends it.
          </p>
        </form>
      ) : null}

      {pendingOnes.length > 0 ? (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {pendingOnes.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-ink">
                  {new Date(d.sendAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  → {d.to}
                </p>
                <p className="text-[11px] text-muted">Pending</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => cancel(d.id)}
                aria-label={`Cancel delivery to ${d.to}`}
                className="rounded p-1.5 text-muted hover:text-red disabled:opacity-60"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {history.length > 0 ? (
        <ul className="mt-2 divide-y divide-line border-t border-line">
          {history.slice(0, 5).map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-ink">
                  {new Date(d.sendAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  → {d.to}
                </p>
                <p
                  className={
                    d.status === "sent"
                      ? "text-[11px] text-forest"
                      : "text-[11px] text-red"
                  }
                >
                  {d.status}
                  {d.error ? ` · ${d.error}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
