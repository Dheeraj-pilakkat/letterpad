"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { respondToDocumentAction } from "@/lib/actions/portal";

/** Client-side accept/reject controls for quotations in the portal. */
export function ApproveRejectButtons({
  token,
  documentId,
  status,
  docNumber,
}: {
  token: string;
  documentId: string;
  status: string;
  docNumber: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== "sent" && status !== "viewed") return null;

  async function respond(decision: "accepted" | "rejected") {
    const question =
      decision === "accepted"
        ? `Accept quotation ${docNumber}?`
        : `Reject quotation ${docNumber}? This cannot be undone from this page.`;
    if (!window.confirm(question)) return;
    setBusy(decision);
    setError(null);
    try {
      const res = await respondToDocumentAction(token, documentId, decision);
      if (!res.ok) setError(res.error ?? "Could not submit your response");
      else router.refresh();
    } catch {
      setError("Could not submit your response");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-[3px] border border-line bg-white p-4">
      <p className="text-sm font-medium text-ink">Your response is needed</p>
      <p className="mt-1 text-xs text-muted">
        Review the quotation above, then accept or reject it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => respond("accepted")}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-[3px] bg-forest px-4 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
        >
          {busy === "accepted" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Check size={14} />
          )}
          Accept quotation
        </button>
        <button
          type="button"
          onClick={() => respond("rejected")}
          disabled={busy !== null}
          className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-4 text-sm font-medium text-ink hover:bg-paper disabled:opacity-50"
        >
          {busy === "rejected" ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <X size={14} />
          )}
          Reject
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
