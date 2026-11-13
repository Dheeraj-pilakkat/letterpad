"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import {
  PLANS,
  checkDocumentQuota,
  currentPlanId,
  hasPlanFeature,
  isPlanId,
} from "@/lib/plans";
import {
  cancelToFree,
  setPendingPlanOrder,
} from "@/lib/subscription";
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  razorpayKeyIdFor,
  toMinorUnits,
} from "@/lib/razorpay";
import { countDocumentsThisMonth } from "@/lib/documents-quota";
import type { PlanId } from "@/lib/db/types";

export type CheckoutResult = {
  ok: boolean;
  orderId?: string;
  keyId?: string;
  amount?: number;
  currency?: string;
  error?: string;
};

export type ActionResult = { ok: boolean; error?: string };

/**
 * Create a Razorpay order for one month of a paid plan. The browser opens
 * Checkout, then confirms through /api/razorpay/verify with { plan }.
 */
export async function startPlanCheckoutAction(planId: string): Promise<CheckoutResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role !== "owner") {
      return { ok: false, error: "Only the owner can change the plan" };
    }
    if (!isPlanId(planId) || planId === "free") {
      return { ok: false, error: "Unknown plan" };
    }
    const plan = PLANS[planId as PlanId];
    if (plan.priceInr <= 0) return { ok: false, error: "This plan is free" };
    if (!isRazorpayConfigured(workspace)) {
      return {
        ok: false,
        error: "Razorpay is not configured — add your keys under Letterhead settings first",
      };
    }

    const keyId = razorpayKeyIdFor(workspace);
    const secret = workspace.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !secret) {
      return { ok: false, error: "Razorpay keys are incomplete" };
    }

    const result = await createRazorpayOrder({
      keyId,
      secret,
      amountMinor: toMinorUnits(plan.priceInr),
      currency: "INR",
      receipt: `sub-${workspace.slug}-${Date.now()}`.slice(0, 255),
      notes: {
        kind: "subscription",
        plan: plan.id,
        workspaceId: workspace._id.toHexString(),
      },
    });
    if (!result.ok || !result.orderId) {
      return { ok: false, error: result.error ?? "Could not start checkout" };
    }

    await setPendingPlanOrder(workspace._id, plan.id, result.orderId);
    return {
      ok: true,
      orderId: result.orderId,
      keyId,
      amount: toMinorUnits(plan.priceInr),
      currency: "INR",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not start checkout",
    };
  }
}

/** Downgrade to the free plan immediately (upgrades go through checkout). */
export async function changePlanAction(planId: string): Promise<ActionResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role !== "owner") {
      return { ok: false, error: "Only the owner can change the plan" };
    }
    if (planId !== "free" || !isPlanId(planId)) {
      return { ok: false, error: "Paid plans are activated through checkout" };
    }
    await cancelToFree(workspace._id);
    revalidatePath("/app/settings/billing");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not change plan",
    };
  }
}

/** § white-label: hide Letterpad branding on portal/share pages (Business). */
export async function setWhiteLabelAction(enabled: boolean): Promise<ActionResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role !== "owner") {
      return { ok: false, error: "Only the owner can change branding" };
    }
    if (enabled && !hasPlanFeature(workspace, "whiteLabel")) {
      return { ok: false, error: "White-label branding needs the Business plan" };
    }
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $set: { whiteLabel: enabled, updatedAt: new Date() } },
    );
    revalidatePath("/app/settings/billing");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not update branding",
    };
  }
}

/** Usage snapshot for the billing page. */
export async function billingUsage(): Promise<{
  planId: PlanId;
  createdThisMonth: number;
  quotaOk: boolean;
}> {
  const { workspace } = await requireWorkspace();
  const planId = currentPlanId(workspace);
  const createdThisMonth = await countDocumentsThisMonth(workspace._id);
  return {
    planId,
    createdThisMonth,
    quotaOk: checkDocumentQuota(workspace, createdThisMonth).ok,
  };
}
