"use client";

import { useState, useTransition } from "react";
import { setWhiteLabelAction } from "@/lib/actions/billing";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

/** § white-label toggle — Business plan only. */
export function WhiteLabelToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    startTransition(async () => {
      const res = await setWhiteLabelAction(next);
      if (!res.ok) {
        setOn(!next);
        setError(res.error ?? "Failed to update branding");
      }
    });
  }

  return (
    <div>
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
      {error ? (
        <p className="mt-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
