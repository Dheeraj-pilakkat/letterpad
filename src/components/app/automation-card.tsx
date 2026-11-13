"use client";

import { useState, useTransition } from "react";
import { Zap } from "lucide-react";
import { setAutoRemindersAction } from "@/lib/actions/workflows";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

/** Toggle for cron-driven automatic payment reminders (workspace setting). */
export function AutomationCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const res = await setAutoRemindersAction(next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Failed to update setting");
      }
    });
  }

  return (
    <section className="rounded-[4px] border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Zap size={14} className="text-royal" /> Automated payment reminders
          </h2>
          <p className="mt-1 max-w-xl text-xs text-muted">
            When the cron job runs, overdue invoices with an outstanding balance
            get a polite reminder email to their client — at most one every 7
            days, up to 3 per document. Requires RESEND_API_KEY; respects your
            client&apos;s email on file.
          </p>
          {error ? (
            <p className="mt-2 text-sm text-red" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={
              on
                ? "rounded-full bg-forest/15 px-2.5 py-1 text-xs font-medium text-forest"
                : "rounded-full bg-paper-dim px-2.5 py-1 text-xs font-medium text-muted"
            }
          >
            {on ? "On" : "Off"}
          </span>
          <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
            {pending ? <Spinner /> : null} {on ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </div>
    </section>
  );
}
