"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { toObjectId } from "@/lib/auth/session";
import { isPlanId } from "@/lib/plans";
import { activatePlan, cancelToFree } from "@/lib/subscription";

export type AdminActionResult = { ok: boolean; error?: string };

/**
 * Manually set a workspace's plan (§21 admin panel). `free` cancels the
 * subscription; paid plans are recorded as active for one month, provider
 * "manual" (no Razorpay involved).
 */
export async function setPlanAction(
  workspaceId: string,
  planId: string,
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const objectId = toObjectId(workspaceId);
    if (!objectId) return { ok: false, error: "Invalid workspace id" };
    if (!isPlanId(planId)) return { ok: false, error: "Unknown plan" };

    if (planId === "free") {
      await cancelToFree(objectId);
    } else {
      await activatePlan({
        workspaceId: objectId,
        plan: planId,
        provider: "manual",
      });
    }

    revalidatePath("/admin/workspaces");
    revalidatePath("/admin/subscriptions");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to set plan" };
  }
}
