/**
 * Phase 5 — WhatsApp sharing (§11.2).
 *
 * Uses WhatsApp's official click-to-chat links (wa.me) — no Cloud API
 * credentials required and fully within WhatsApp's public sharing policies.
 * The recipient opens WhatsApp with the message prefilled; the user presses
 * send. Pure helpers so formatting is unit-testable.
 */

export interface WhatsAppMessageInput {
  workspaceName: string;
  docNumber: string;
  label: string;
  url: string;
  /** "share" (document link), "payment" (pay link), or "reminder" */
  kind?: "share" | "payment" | "reminder";
  balance?: number;
  currency?: string;
  contactName?: string;
  overdueDays?: number;
}

/**
 * Reduce a phone string to wa.me digits: strip everything but digits and a
 * leading country-code "00". Local numbers without a country code won't dial.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

export function isValidPhone(raw: string | null | undefined): boolean {
  const digits = normalizePhone(raw);
  return digits.length >= 7 && digits.length <= 15;
}

/** https://wa.me/<digits>?text=<encoded message> */
export function whatsappShareUrl(phone: string, message: string): string {
  const digits = normalizePhone(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function money(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

/** Prefilled message covering share / payment-link / reminder cases. */
export function whatsappMessage(input: WhatsAppMessageInput): string {
  const greet = input.contactName ? `Hi ${input.contactName},` : "Hello,";
  const from = `${input.label} ${input.docNumber} from ${input.workspaceName}`;

  if (input.kind === "reminder") {
    const overdue =
      input.overdueDays && input.overdueDays > 0
        ? ` (now ${input.overdueDays} day${input.overdueDays === 1 ? "" : "s"} overdue)`
        : "";
    return [
      greet,
      "",
      `A friendly reminder that ${from}${
        input.balance != null && input.currency
          ? ` with an outstanding balance of ${money(input.balance, input.currency)}${overdue}`
          : ""
      } is awaiting payment.`,
      "",
      `View & pay online: ${input.url}`,
      "",
      `— ${input.workspaceName}`,
    ].join("\n");
  }

  if (input.kind === "payment") {
    const lines = [
      greet,
      "",
      `Here is the payment link for ${from}.`,
    ];
    if (input.balance != null && input.currency) {
      lines.push(`Amount due: ${money(input.balance, input.currency)}`);
    }
    lines.push("", input.url, "", "Thank you,", input.workspaceName);
    return lines.join("\n");
  }

  return [
    greet,
    "",
    `Please find ${from}.`,
    "",
    `View online: ${input.url}`,
    "",
    `Let me know if you have any questions.`,
    `— ${input.workspaceName}`,
  ].join("\n");
}
