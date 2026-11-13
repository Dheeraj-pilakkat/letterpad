"use client";

import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { whatsappShareAction } from "@/lib/actions/sharing";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

/**
 * §11.2 — share this document through WhatsApp via an official wa.me
 * click-to-chat link with the message prefilled.
 */
export function WhatsAppButton({
  docId,
  hasPhone,
  kind = "share",
}: {
  docId: string;
  hasPhone: boolean;
  kind?: "share" | "payment" | "reminder";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const res = await whatsappShareAction(docId, kind);
      if (!res.ok || !res.url) {
        setError(res.error ?? "Failed to prepare WhatsApp message");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={open}
        disabled={pending}
        title={
          hasPhone
            ? "Share through WhatsApp with the document link"
            : "Add a phone number to the client first"
        }
      >
        {pending ? <Spinner /> : <MessageCircle size={14} />} WhatsApp
      </Button>
      {error ? (
        <p className="mt-2 w-full text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
