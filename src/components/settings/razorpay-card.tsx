"use client";

import { useRef, useState, useTransition } from "react";
import { saveRazorpaySettings } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function RazorpayCard({
  keyId,
  hasSecret,
}: {
  keyId?: string | null;
  hasSecret: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFlash(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await saveRazorpaySettings(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setFlash("Saved — Pay now buttons appear on payable documents.");
      formRef.current?.reset();
      setTimeout(() => setFlash(null), 3500);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <div>
        <p className="text-sm text-muted">
          Accept online payments through Razorpay Checkout. Add your key id and secret from the
          Razorpay dashboard — the secret is stored securely and never shown again.
        </p>
        {keyId ? (
          <p className="mt-2 text-xs text-forest">
            Configured · key <span className="font-mono">{keyId}</span>
            {hasSecret ? " · secret saved" : ""}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">Not configured yet.</p>
        )}
      </div>
      {error ? (
        <p className="rounded-[3px] bg-red/10 px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Key ID">
          <Input
            name="razorpayKeyId"
            defaultValue={keyId ?? ""}
            placeholder="rzp_live_xxxxxxxx"
            autoComplete="off"
          />
        </Field>
        <Field label="Key secret" hint={hasSecret ? "Saved — leave blank to keep" : ""}>
          <Input
            name="razorpayKeySecret"
            type="password"
            defaultValue=""
            placeholder={hasSecret ? "••••••••" : "xxxxxxxxxxxxxxxx"}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner /> : null} Save Razorpay
        </Button>
        {flash ? <span className="text-sm text-forest">{flash}</span> : null}
      </div>
      <p className="text-xs text-muted">
        Leave both fields empty to remove Razorpay. Webhook URL for the dashboard:{" "}
        <span className="font-mono text-[11px]">/api/razorpay/webhook</span>
      </p>
    </form>
  );
}
