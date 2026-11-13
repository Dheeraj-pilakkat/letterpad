"use client";

import { useState, useTransition } from "react";
import {
  generateApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
} from "@/lib/actions/api-keys";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

/** Generate / rotate / revoke controls for the public API key. */
export function ApiKeyControls({ hasKey }: { hasKey: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; key?: string; error?: string }>) {
    setError(null);
    setFreshKey(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      if (res.key) setFreshKey(res.key);
    });
  }

  return (
    <div>
      {freshKey ? (
        <div className="mb-4 rounded-[4px] border border-forest/30 bg-forest/5 p-3">
          <p className="text-xs font-medium text-forest">
            {hasKey ? "Rotated — the old key no longer works." : "Key created."}{" "}
            Copy it now — you can view it again anytime.
          </p>
          <code className="mt-2 block break-all rounded-[3px] bg-white px-2 py-1.5 text-xs text-ink">
            {freshKey}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigator.clipboard?.writeText(freshKey)}
          >
            Copy key
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {hasKey ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm(
                    "Rotate the API key? Integrations using the old key will stop working.",
                  )
                ) {
                  run(rotateApiKeyAction);
                }
              }}
            >
              {pending ? <Spinner /> : null} Rotate
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm("Revoke the API key? API access will stop immediately.")) {
                  run(revokeApiKeyAction);
                }
              }}
            >
              {pending ? <Spinner /> : null} Revoke
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(generateApiKeyAction)}
          >
            {pending ? <Spinner /> : null} Generate API key
          </Button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
