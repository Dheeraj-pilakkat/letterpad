import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import { addInterval, numberingConfig } from "@/lib/recurring";
import { nextDocumentNumber } from "@/lib/counters";
import { computeTotals } from "@/lib/validation/schemas";
import { templateById } from "@/lib/templates/registry";
import { todayIsoDate } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import type { Workspace } from "@/lib/db/types";

export type RunResult = { ok: boolean; error?: string; id?: string };

/**
 * Create a draft document from a schedule and advance nextRunAt.
 * Session-free so both the server action wrapper and the cron route can call it.
 * `actorId` becomes the document's createdBy (owner id or the schedule creator).
 */
export async function runScheduleCore(
  workspace: Workspace,
  actorId: string,
  scheduleId: ObjectId,
): Promise<RunResult> {
  try {
    const schedule = await collections
      .schedules()
      .findOne({ _id: scheduleId, workspaceId: workspace._id });
    if (!schedule) return { ok: false, error: "Schedule not found" };
    if (schedule.status !== "active") {
      return { ok: false, error: `Schedule is ${schedule.status}` };
    }

    const template = templateById(schedule.templateId);
    if (!template) return { ok: false, error: "Unknown template" };

    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      schedule.type,
      numberingConfig(workspace, schedule.type),
    );

    const discount = schedule.discount;
    const totals = computeTotals(schedule.items, discount);
    const now = new Date();
    const issueDate = todayIsoDate();
    const dueDate =
      schedule.type === "invoice" || schedule.type === "request"
        ? addDays(issueDate, 15)
        : undefined;

    const insert = await collections.documents().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      type: schedule.type,
      templateId: schedule.templateId,
      number,
      status: "draft",
      title: schedule.title || "",
      contactId: schedule.contactId,
      issueDate,
      dueDate,
      currency: schedule.currency,
      items: schedule.items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      discount,
      content: {
        subject: schedule.content?.subject || "",
        body: schedule.content?.body || "",
        terms: schedule.content?.terms || "",
      },
      layout: schedule.layout,
      createdBy: actorId,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    const nextRunAt = addInterval(
      schedule.nextRunAt || schedule.startDate,
      schedule.interval,
    );
    const pastEnd = schedule.endDate ? nextRunAt > schedule.endDate : false;

    await collections.schedules().updateOne(
      { _id: scheduleId },
      {
        $set: {
          nextRunAt,
          lastRunAt: todayIsoDate(),
          lastDocumentId: insert.insertedId,
          runCount: (schedule.runCount ?? 0) + 1,
          status: pastEnd ? "completed" : schedule.status,
          updatedAt: now,
        },
      },
    );

    await logActivity({
      workspaceId: workspace._id,
      documentId: insert.insertedId,
      type: "created",
      message: `Generated from recurring schedule (${schedule.interval})`,
      actor: actorId,
    });

    return { ok: true, id: insert.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to run schedule",
    };
  }
}

/**
 * Run every due active schedule across all workspaces (cron path).
 * Best-effort: failures are counted, never thrown.
 */
export async function runAllDueSchedules(limit = 200): Promise<{
  ran: number;
  failed: number;
}> {
  const today = todayIsoDate();
  const due = await collections
    .schedules()
    .find({
      status: "active",
      nextRunAt: { $lte: today },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gte: today } }],
    })
    .limit(limit)
    .toArray();

  let ran = 0;
  let failed = 0;
  for (const s of due) {
    const workspace = await collections.workspaces().findOne({ _id: s.workspaceId });
    if (!workspace) {
      failed += 1;
      continue;
    }
    const actor =
      s.createdBy || workspace.ownerUserId || "system";
    const res = await runScheduleCore(workspace, actor, s._id);
    if (res.ok) ran += 1;
    else failed += 1;
  }
  return { ran, failed };
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
