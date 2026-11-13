"use client";

import { useState, useTransition } from "react";
import {
  removeWebhookAction,
  saveWebhookAction,
  testWebhookAction,
  type WebhookActionResult,
} from "@/lib/actions/webhooks";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

/** Webhook endpoint form + test/remove controls. */
export function WebhookForm({
  url,
  enabled,
  secret,
  canUse,
}: {
  url: string;
  enabled: boolean;
  secret: string | null;
  canUse: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<WebhookActionResult | null>(null);

  if (!canUse) {
    return (
      <p className="text-xs text-muted">
        Outbound webhooks are available on the Starter plan and above.
      </p>
    );
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setState(null);
    startTransition(async () => {
      setState(await saveWebhookAction(formData));
    });
  }

  function test() {
    setState(null);
    startTransition(async () => {
      setState(await testWebhookAction());
    });
  }

  function remove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      !window.confirm("Remove this webhook endpoint? The secret is discarded.")
    ) {
      return;
    }
    setState(null);
    startTransition(async () => {
      setState(await removeWebhookAction());
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-3">
        <Field label="Endpoint URL" hint="We POST JSON events here over HTTPS">
          <Input
            name="url"
            type="url"
            defaultValue={url}
            placeholder="https://example.com/webhooks/letterpad"
            required
          />
        </Field>
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={enabled}
            className="size-3.5 accent-royal"
          />
          <span className="text-xs font-medium text-ink-soft">Enabled</span>
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner /> : null} Save endpoint
        </Button>
      </form>

      {state && !state.ok && state.error ? (
        <p className="text-sm text-red" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-forest" role="status">
          Saved.
        </p>
      ) : null}

      {secret ? (
        <div className="rounded-[4px] border border-line bg-paper px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted">Signing secret</p>
          <p className="mt-1 break-all font-mono text-xs text-ink">{secret}</p>
          <p className="mt-1 text-[11px] text-muted">
            Verify <code>X-Letterpad-Signature</code> as HMAC-SHA256 of the raw
            body with this secret.
          </p>
        </div>
      ) : null}

      {url ? (
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <Button variant="outline" size="sm" onClick={test} disabled={pending}>
            {pending ? <Spinner /> : null} Send test event
          </Button>
          <form onSubmit={remove}>
            <Button variant="ghost" size="sm" type="submit" disabled={pending}>
              Remove
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
