"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let checkoutScriptPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        checkoutScriptPromise = null;
        reject(new Error("Failed to load Razorpay Checkout"));
      };
      document.body.appendChild(script);
    });
  }
  return checkoutScriptPromise;
}

/** Opens Razorpay Checkout for the outstanding balance of a document. */
export function PayNowButton({
  documentId,
  keyId,
  balance,
  currency,
  docNumber,
  portalToken,
}: {
  documentId: string;
  keyId: string;
  balance: number;
  currency: string;
  docNumber: string;
  /** When set, orders are created/verified through the token-scoped portal routes */
  portalToken?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderEndpoint = portalToken
    ? `/api/portal/${portalToken}/pay/order`
    : "/api/razorpay/order";
  const verifyEndpoint = portalToken
    ? `/api/portal/${portalToken}/pay/verify`
    : "/api/razorpay/verify";

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(orderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = (await res.json()) as {
        orderId?: string;
        keyId?: string;
        amount?: number;
        currency?: string;
        error?: string;
      };
      if (!res.ok || !data.orderId) {
        throw new Error(data.error ?? "Could not start payment");
      }

      await loadCheckoutScript();
      if (!window.Razorpay) throw new Error("Razorpay Checkout failed to load");

      const rzp = new window.Razorpay({
        key: data.keyId ?? keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency ?? currency,
        name: "Letterpad",
        description: `Payment for ${docNumber}`,
        prefill: { email: "", contact: "" },
        theme: { color: "#3B5BDB" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verify = await fetch(verifyEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (!verify.ok) {
              const err = (await verify.json().catch(() => ({}))) as { error?: string };
              setError(err.error ?? "Payment could not be confirmed");
            }
          } catch {
            setError("Payment made — confirmation failed, refresh shortly");
          } finally {
            setBusy(false);
            router.refresh();
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed to start");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={pay}
        disabled={busy || balance <= 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-[3px] bg-forest px-4 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : null}
        Pay {formatMoney(balance, currency)} online
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
