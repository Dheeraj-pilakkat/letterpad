import { createHmac, timingSafeEqual } from "crypto";
import type { Workspace } from "@/lib/db/types";

/* ============================================================
   Razorpay Checkout helpers — order creation and HMAC signature
   verification. Server-side only (uses the key secret).
   ============================================================ */

const API_BASE = "https://api.razorpay.com/v1";

export function razorpayKeyIdFor(ws: Pick<Workspace, "razorpayKeyId">): string | null {
  return ws.razorpayKeyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null;
}

export function razorpaySecretFor(ws: Pick<Workspace, "razorpayKeySecret">): string | null {
  return ws.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || null;
}

export function isRazorpayConfigured(ws: Pick<Workspace, "razorpayKeyId" | "razorpayKeySecret">): boolean {
  return Boolean(razorpayKeyIdFor(ws) && razorpaySecretFor(ws));
}

/** Convert a decimal amount to minor units (paise) for the Razorpay API. */
export function toMinorUnits(amount: number): number {
  return Math.max(1, Math.round(amount * 100));
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function createRazorpayOrder(opts: {
  keyId: string;
  secret: string;
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  const auth = Buffer.from(`${opts.keyId}:${opts.secret}`).toString("base64");
  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: opts.amountMinor,
        currency: opts.currency,
        receipt: opts.receipt.slice(0, 255),
        notes: opts.notes,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Razorpay order failed (${res.status}) ${detail}`.trim() };
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) return { ok: false, error: "Razorpay returned no order id" };
    return { ok: true, orderId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Razorpay order failed" };
  }
}

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, secret). */
export function verifyCheckoutSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}): boolean {
  const expected = createHmac("sha256", opts.secret)
    .update(`${opts.orderId}|${opts.paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, opts.signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, secret). */
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Razorpay webhook payload shapes we care about. */
export interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        /** Copied from the order's notes (subscription checkouts) */
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity?: { id?: string };
    };
  };
}
