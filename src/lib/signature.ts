import type { SignatureMethod } from "@/lib/db/types";

/* ============================================================
   Phase 3 pure helpers — signature validation and the email
   copy used by approval requests, payment reminders and payment
   confirmations. No DB / Next.js imports: unit-tested directly.
   ============================================================ */

export const SIGNATURE_MAX_BYTES = 200 * 1024;

const DATA_URI_RE = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\s]+)$/;

/** Validate a drawn/uploaded signature data-URI (PNG or JPEG, ≤200KB). */
export function validateSignatureImage(
  dataUri: string,
): { ok: boolean; error?: string } {
  const match = DATA_URI_RE.exec(dataUri.trim());
  if (!match) return { ok: false, error: "Signature must be a PNG or JPEG image" };
  // base64 length ≈ 4/3 of the raw byte size
  const approxBytes = Math.floor((match[2].replace(/\s/g, "").length * 3) / 4);
  if (approxBytes > SIGNATURE_MAX_BYTES) {
    return { ok: false, error: "Signature image must be under 200KB" };
  }
  return { ok: true };
}

/** Sanitised name for a typed signature. */
export function typedSignatureText(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, 80);
}

export interface ReviewRequestEmail {
  subject: string;
  text: string;
}

/** "Please review & approve" or "Please sign" email with the document link. */
export function reviewRequestEmail(input: {
  workspaceName: string;
  docNumber: string;
  label: string;
  url: string;
  kind: "approval" | "signature";
  clientName?: string;
}): ReviewRequestEmail {
  const greeting = input.clientName ? `Hello ${input.clientName},` : "Hello,";
  const subject =
    input.kind === "signature"
      ? `Signature requested: ${input.docNumber}`
      : `Please review: ${input.docNumber}`;
  const body =
    input.kind === "signature"
      ? `${greeting}\n\n${input.workspaceName} has asked you to sign ${input.label} ${input.docNumber}.\n\nReview and sign online: ${input.url}\n\nThank you.`
      : `${greeting}\n\nPlease review and approve ${input.label} ${input.docNumber} from ${input.workspaceName}.\n\nView online: ${input.url}\n\nThank you.`;
  return { subject, text: body };
}

export interface ReminderEmail {
  subject: string;
  text: string;
}

/** Friendly-but-clear payment reminder for an outstanding document. */
export function paymentReminderEmail(input: {
  workspaceName: string;
  docNumber: string;
  balance: number;
  currency: string;
  dueDate?: string;
  url: string;
  contactName?: string;
  overdueDays?: number;
}): ReminderEmail {
  const greeting = input.contactName ? `Hello ${input.contactName},` : "Hello,";
  const amount = `${input.balance.toFixed(2)} ${input.currency}`;
  const timing = input.overdueDays && input.overdueDays > 0
    ? `This payment was due on ${input.dueDate ?? "the due date"} and is now ${input.overdueDays} day${input.overdueDays === 1 ? "" : "s"} overdue.`
    : input.dueDate
      ? `Payment of ${amount} is due on ${input.dueDate}.`
      : `Payment of ${amount} is outstanding.`;
  return {
    subject: `Payment reminder: ${input.docNumber} — ${amount}`,
    text: `${greeting}\n\nThis is a friendly reminder that ${input.docNumber} from ${input.workspaceName} has an outstanding balance of ${amount}.\n\n${timing}\n\nView the document and pay online: ${input.url}\n\nIf you have already paid, please disregard this message.\n\nThank you.`,
  };
}

export interface ConfirmationEmail {
  subject: string;
  text: string;
}

/** Sent to the client after a payment is recorded. */
export function paymentConfirmationEmail(input: {
  workspaceName: string;
  docNumber: string;
  amount: number;
  currency: string;
  date: string;
  remaining?: number;
  contactName?: string;
}): ConfirmationEmail {
  const greeting = input.contactName ? `Hello ${input.contactName},` : "Hello,";
  const amount = `${input.amount.toFixed(2)} ${input.currency}`;
  const remainingLine =
    input.remaining && input.remaining > 0
      ? `\n\nAn outstanding balance of ${input.remaining.toFixed(2)} ${input.currency} remains on this document.`
      : "\n\nThis document is now fully paid.";
  return {
    subject: `Payment received: ${input.docNumber} — ${amount}`,
    text: `${greeting}\n\nWe have received your payment of ${amount} for ${input.docNumber} on ${input.date}.${remainingLine}\n\nThank you,\n${input.workspaceName}`,
  };
}

/** Human label for a signature method. */
export function signatureMethodLabel(method: SignatureMethod): string {
  switch (method) {
    case "drawn":
      return "drawn signature";
    case "uploaded":
      return "uploaded signature image";
    case "typed":
      return "typed signature";
  }
}
