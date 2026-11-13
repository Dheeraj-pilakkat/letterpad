"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { logActivity } from "@/lib/activity";
import { validateSendAt } from "@/lib/automation";
import type { ActionResult } from "@/lib/actions/documents";

export interface ScheduleDeliveryInput {
  documentId: string;
  /** ISO datetime string (UTC or local — parsed as a date) */
  sendAt: string;
  to: string;
  subject?: string;
  message?: string;
}

/** Queue a document email for a future time (cron delivers it). */
export async function scheduleDeliveryAction(
  input: ScheduleDeliveryInput,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(input.documentId);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };

    const to = input.to.trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { ok: false, error: "Enter a valid recipient email" };
    }

    const at = new Date(input.sendAt);
    if (Number.isNaN(at.getTime())) {
      return { ok: false, error: "Pick a valid date and time" };
    }
    const gate = validateSendAt(at.toISOString());
    if (!gate.ok) return { ok: false, error: gate.error };

    const now = new Date();
    const result = await collections.deliveries().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      documentId: objectId,
      sendAt: at.toISOString(),
      to,
      subject: input.subject?.trim() || undefined,
      message: input.message?.trim() || undefined,
      status: "pending",
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "emailed",
      message: `Delivery scheduled to ${to} for ${at.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      actor: user.id,
    });

    revalidatePath(`/app/documents/${input.documentId}`);
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to schedule delivery",
    };
  }
}

/** Cancel a pending scheduled delivery. */
export async function cancelDeliveryAction(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid delivery id" };

    const delivery = await collections
      .deliveries()
      .findOne({ _id: objectId, workspaceId: workspace._id, status: "pending" });
    if (!delivery) {
      return { ok: false, error: "Delivery not found or already processed" };
    }

    await collections.deliveries().updateOne(
      { _id: delivery._id },
      { $set: { status: "cancelled", updatedAt: new Date() } },
    );
    await logActivity({
      workspaceId: workspace._id,
      documentId: delivery.documentId,
      type: "emailed",
      message: `Scheduled delivery to ${delivery.to} cancelled`,
      actor: user.id,
    });

    revalidatePath(`/app/documents/${delivery.documentId.toHexString()}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to cancel delivery",
    };
  }
}
