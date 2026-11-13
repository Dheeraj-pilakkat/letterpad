"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  disableContactPortal,
  enableContactPortal,
} from "@/lib/actions/portal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

export function PortalButton({
  contactId,
  enabled,
  token,
}: {
  contactId: string;
  enabled: boolean;
  token?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const action = enabled ? disableContactPortal : enableContactPortal;
      const res = await action(contactId);
      if (res.ok && res.url) {
        await navigator.clipboard?.writeText(res.url).catch(() => {});
      }
      router.refresh();
    });
  }

  function copyLink() {
    if (!token) return;
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? window.location.origin;
    navigator.clipboard?.writeText(`${origin}/portal/${token}`).catch(() => {});
  }

  return (
    <div className="flex items-center gap-2">
      {enabled && token ? (
        <button
          type="button"
          onClick={copyLink}
          className="text-xs text-royal hover:underline"
        >
          Copy portal link
        </button>
      ) : null}
      <Button
        type="button"
        variant={enabled ? "ghost" : "outline"}
        size="sm"
        disabled={pending}
        onClick={toggle}
      >
        {pending ? <Spinner /> : null}
        {enabled ? "Disable portal" : "Enable portal"}
      </Button>
    </div>
  );
}
