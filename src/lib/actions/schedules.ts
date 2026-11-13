"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { templateById } from "@/lib/templates/registry";
import { todayIsoDate } from "@/lib/utils";
import { runScheduleCore } from "@/lib/recurring-runner";
import type {
  DocumentItem,
  DocumentType,
  RecurrenceInterval,
  ScheduleStatus,
} from "@/lib/db/types";
import { getActiveProfile } from "@/lib/profiles";
import { overlayBranding } from "@/lib/branding";

export type ActionResult = { ok: boolean; error?: string; id?: string };

export interface CreateScheduleInput {
  type: DocumentType;
  templateId: string;
  contactId?: string;
  title?: string;
  interval: RecurrenceInterval;
  startDate: string;
  endDate?: string;
  currency: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
  content?: { subject?: string; body?: string; terms?: string };
  discount?: { type: "percent" | "amount"; value: number };
}

export async function createSchedule(
  input: CreateScheduleInput,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();

    const template = templateById(input.templateId);
    if (!template || template.type !== input.type) {
      return { ok: false, error: "Unknown template for this type" };
    }
    if (!input.startDate) return { ok: false, error: "Start date is required" };
    if (input.endDate && input.endDate < input.startDate) {
      return { ok: false, error: "End date must be after the start date" };
    }

    const contactId = input.contactId ? toObjectId(input.contactId) : null;
    if (input.contactId && !contactId) {
      return { ok: false, error: "Invalid contact" };
    }

    const items: DocumentItem[] = input.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      amount: Math.round(Number(item.quantity) * Number(item.unitPrice) * 100) / 100,
    }));

    const now = new Date();
    // §6: stamp the active profile so generated documents keep its identity.
    const profile = await getActiveProfile(workspace._id);
    const brand = overlayBranding(workspace, profile);
    const result = await collections.schedules().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      ...(profile ? { profileId: profile._id } : {}),
      contactId,
      type: input.type,
      templateId: input.templateId,
      title: input.title?.trim() || undefined,
      interval: input.interval,
      status: "active",
      startDate: input.startDate,
      endDate: input.endDate || undefined,
      nextRunAt: input.startDate,
      runCount: 0,
      currency: input.currency || brand.currency,
      items,
      discount: input.discount,
      content: {
        subject: input.content?.subject || "",
        body: input.content?.body || "",
        terms: input.content?.terms || "",
      },
      layout: {
        ...template.layout,
        accentColor: brand.brandColors?.[0] ?? brand.brandColor,
      },
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });

    revalidatePath("/app/recurring");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create schedule",
    };
  }
}

export async function setScheduleStatus(
  id: string,
  status: ScheduleStatus,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid schedule id" };

    const allowed: ScheduleStatus[] = ["active", "paused", "completed"];
    if (!allowed.includes(status)) {
      return { ok: false, error: "Invalid status" };
    }

    const result = await collections
      .schedules()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { status, updatedAt: new Date() } },
      );
    if (result.matchedCount === 0) {
      return { ok: false, error: "Schedule not found" };
    }
    revalidatePath("/app/recurring");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update schedule",
    };
  }
}

/** Create a draft document from a schedule and advance nextRunAt. */
export async function runSchedule(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid schedule id" };

    const res = await runScheduleCore(workspace, user.id, objectId);
    if (!res.ok) return res;

    revalidatePath("/app/recurring");
    revalidatePath("/app/documents");
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to run schedule",
    };
  }
}

/** Run every due active schedule (best-effort; used when opening the recurring page). */
export async function runDueSchedules(): Promise<{ ran: number; error?: string }> {
  try {
    const { workspace } = await requireWorkspace();
    const today = todayIsoDate();
    const due = await collections
      .schedules()
      .find({
        workspaceId: workspace._id,
        status: "active",
        nextRunAt: { $lte: today },
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: today } },
        ],
      })
      .limit(10)
      .toArray();

    let ran = 0;
    for (const s of due) {
      const res = await runScheduleCore(workspace, workspace.ownerUserId, s._id);
      if (res.ok) ran += 1;
    }
    if (ran > 0) revalidatePath("/app/recurring");
    return { ran };
  } catch (e) {
    return {
      ran: 0,
      error: e instanceof Error ? e.message : "Failed to run due schedules",
    };
  }
}
