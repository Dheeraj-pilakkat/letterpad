/**
 * Document share tokens + optional outbound email.
 *
 * Email: if RESEND_API_KEY is set, messages are sent via the Resend HTTP API.
 * Otherwise the UI falls back to a mailto: draft that includes the share link.
 */

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Public share links live 30 days from creation or refresh. */
export const SHARE_TTL_DAYS = 30;
/** Client-portal links live 180 days; active use slides the expiry forward. */
export const PORTAL_TTL_DAYS = 180;
/** Renew a portal when fewer than this many days remain. */
export const PORTAL_RENEW_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

export function generateShareToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/** Expiry timestamp for a freshly enabled share link. */
export function shareExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SHARE_TTL_DAYS * DAY_MS);
}

/** Expiry timestamp for a freshly enabled portal link. */
export function portalExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + PORTAL_TTL_DAYS * DAY_MS);
}

/**
 * A link with no stored expiry is treated as expired (links created before
 * expiry tracking must be re-enabled, which issues a fresh token).
 */
export function isExpired(
  at: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!at) return true;
  const time = at instanceof Date ? at.getTime() : Date.parse(at);
  if (Number.isNaN(time)) return true;
  return time <= now.getTime();
}

export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000"
  );
}

export function shareUrl(token: string): string {
  return `${appBaseUrl()}/share/${token}`;
}

export interface EmailInput {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  ok: boolean;
  mode: "resend" | "mailto" | "error";
  error?: string;
}

/** Send via Resend when configured; otherwise report mailto fallback. */
export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: true, mode: "mailto" };
  }
  try {
    const from =
      process.env.EMAIL_FROM ?? "Letterpad <onboarding@resend.dev>";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, mode: "error", error: body || `Email API ${res.status}` };
    }
    return { ok: true, mode: "resend" };
  } catch (e) {
    return {
      ok: false,
      mode: "error",
      error: e instanceof Error ? e.message : "Email failed",
    };
  }
}

export function mailtoHref(input: EmailInput): string {
  const params = new URLSearchParams({ subject: input.subject, body: input.text });
  return `mailto:${encodeURIComponent(input.to)}?${params.toString()}`;
}
