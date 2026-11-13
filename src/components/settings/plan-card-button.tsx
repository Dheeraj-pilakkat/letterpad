"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
import {
  changePlanAction,
  startPlanCheckoutAction,
} from "@/lib/actions/billing";
import type { PlanId } from "@/lib/db/types";

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

/** Select/downgrade button on a plan card (§20 subscription billing). */
export function PlanCardButton({
  planId,
  planName,
  current,
  owner,
  razorpayKeyId,
}: {
  planId: PlanId;
  planName: string;
  current: boolean;
  owner: boolean;
  razorpayKeyId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (current) {
    return (
      <span className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[3px] bg-forest/10 text-sm font-medium text-forest">
        <Check size={14} /> Current plan
      </span>
    );
  }

  async function choose() {
    if (!owner) {
      setError("Only the owner can change the plan");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (planId === "free") {
        const res = await changePlanAction("free");
        if (!res.ok) throw new Error(res.error ?? "Could not downgrade");
        router.refresh();
        return;
      }

      const order = await startPlanCheckoutAction(planId);
      if (!order.ok || !order.orderId) {
        throw new Error(order.error ?? "Could not start checkout");
      }

      await loadCheckoutScript();
      if (!window.Razorpay) throw new Error("Razorpay Checkout failed to load");

      const rzp = new window.Razorpay({
        key: order.keyId ?? razorpayKeyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency ?? "INR",
        name: "Letterpad",
        description: `${planName} plan — monthly`,
        theme: { color: "#3B5BDB" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verify = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                plan: planId,
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
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={choose}
        disabled={busy}
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[3px] bg-ink text-sm font-medium text-paper hover:bg-ink-soft disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {planId === "free" ? "Downgrade to Free" : `Choose ${planName}`}
      </button>
      {error ? (
        <p className="mt-2 text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
