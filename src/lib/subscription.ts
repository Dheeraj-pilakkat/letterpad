/**
 * Phase 6 — subscription state changes (§20). Used by billing actions,
 * the Razorpay verify/webhook routes and the admin panel.
 */

import type { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import type { PlanId } from "@/lib/db/types";
import { isPlanId } from "@/lib/plans";

/** Paid period runs for one month from `from`. */
export function periodEndIso(from: Date = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

/** Activate (or renew) a paid plan. `free` is handled by cancelToFree. */
export async function activatePlan(opts: {
  workspaceId: ObjectId;
  plan: PlanId;
  provider: "razorpay" | "manual";
  referenceId?: string;
}): Promise<void> {
  if (!isPlanId(opts.plan) || opts.plan === "free") return;
  const now = new Date();
  await collections.workspaces().updateOne(
    { _id: opts.workspaceId },
    {
      $set: {
        subscription: {
          plan: opts.plan,
          status: "active",
          currentPeriodEnd: periodEndIso(now),
          provider: opts.provider,
          ...(opts.referenceId ? { referenceId: opts.referenceId } : {}),
          startedAt: now,
          updatedAt: now,
        },
        updatedAt: now,
      },
      $unset: { pendingPlanOrder: "", pendingPlan: "" },
    },
  );
}

/** Move a workspace back to the free plan (keeps history for display). */
export async function cancelToFree(workspaceId: ObjectId): Promise<void> {
  const now = new Date();
  await collections.workspaces().updateOne(
    { _id: workspaceId, "subscription.status": { $ne: "cancelled" } },
    {
      $set: {
        "subscription.status": "cancelled",
        "subscription.updatedAt": now,
        updatedAt: now,
      },
    },
  );
}

/** Record the order a plan checkout is waiting on (bounds verify to this workspace). */
export async function setPendingPlanOrder(
  workspaceId: ObjectId,
  plan: PlanId,
  orderId: string,
): Promise<void> {
  await collections.workspaces().updateOne(
    { _id: workspaceId },
    { $set: { pendingPlanOrder: orderId, pendingPlan: plan, updatedAt: new Date() } },
  );
}
