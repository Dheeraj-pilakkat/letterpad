import { ObjectId } from "mongodb";
import { logActivity } from "@/lib/activity";
import { collections } from "@/lib/db/client";
import { balanceOf } from "@/lib/finance";
import { documentLinkFor } from "@/lib/document-link";
import { sendEmail, mailtoHref } from "@/lib/share";
import { paymentReminderEmail } from "@/lib/signature";
import { autoRemindersEnabled, shouldAutoRemind } from "@/lib/automation";
import { todayIsoDate } from "@/lib/utils";
import type { Workspace } from "@/lib/db/types";

export interface ReminderResult {
  ok: boolean;
  url?: string;
  /** "resend" | "mailto" */
  mode?: string;
  mailto?: string;
  error?: string;
}

/**
 * Session-free payment reminder for one document — shared by the manual
 * server action (sharing.ts) and the cron auto-reminder runner.
 *
 * With `automatic: true` the counters that pace/cap cron reminders are only
 * bumped when the email was actually delivered (Resend configured); a mailto
 * fallback can never be opened by cron, so it reports failure instead.
 */
export async function sendReminderCore(
  workspace: Workspace,
  docId: ObjectId,
  actorId: string,
  opts: { automatic?: boolean } = {},
): Promise<ReminderResult> {
  const automatic = opts.automatic === true;

  const doc = await collections
    .documents()
    .findOne({ _id: docId, workspaceId: workspace._id, deletedAt: null });
  if (!doc) return { ok: false, error: "Document not found" };
  if (!["invoice", "quote", "request"].includes(doc.type)) {
    return { ok: false, error: "Reminders are only sent for bills and requests" };
  }

  const payments = await collections.payments().find({ documentId: doc._id }).toArray();
  const balance = balanceOf(doc.total, payments);
  if (balance <= 0) return { ok: false, error: "This document is fully paid" };

  const contact = doc.contactId
    ? await collections
        .contacts()
        .findOne({ _id: doc.contactId, workspaceId: workspace._id })
    : null;
  const to = contact?.email?.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: "This document has no contact email" };
  }

  const today = todayIsoDate();
  const overdueDays =
    doc.dueDate && doc.dueDate < today
      ? Math.round(
          (new Date(`${today}T00:00:00Z`).getTime() -
            new Date(`${doc.dueDate}T00:00:00Z`).getTime()) /
            86_400_000,
        )
      : 0;

  const url = await documentLinkFor(doc, contact);
  const { subject, text } = paymentReminderEmail({
    workspaceName: workspace.name,
    docNumber: doc.number,
    balance,
    currency: doc.currency,
    dueDate: doc.dueDate,
    url,
    contactName: contact?.name,
    overdueDays,
  });

  const result = await sendEmail({ to, subject, text });

  if (automatic && result.mode !== "resend") {
    // Cron cannot open a mail draft — report failure without burning a reminder slot.
    return {
      ok: false,
      mode: result.mode,
      error: "Email delivery not configured (set RESEND_API_KEY)",
    };
  }
  if (!result.ok) {
    return { ok: false, error: result.error ?? "Failed to send reminder" };
  }

  const delivered = result.mode === "resend";
  await logActivity({
    workspaceId: workspace._id,
    documentId: doc._id,
    type: "reminder",
    message: automatic
      ? delivered
        ? `Automatic payment reminder emailed to ${to} (${balance.toFixed(2)} ${doc.currency} due)`
        : `Automatic reminder prepared for ${to}`
      : delivered
        ? `Payment reminder emailed to ${to} (${balance.toFixed(2)} ${doc.currency} due)`
        : `Payment reminder draft opened for ${to}`,
    actor: actorId,
  });

  if (automatic && delivered) {
    await collections.documents().updateOne(
      { _id: doc._id },
      {
        $set: { autoReminderAt: new Date() },
        $inc: { autoReminderCount: 1 },
      },
    );
  }

  return {
    ok: true,
    url,
    mode: result.mode,
    mailto: mailtoHref({ to, subject, text }),
  };
}

/**
 * Cron pass: send automatic payment reminders for overdue bills.
 * Candidate scan → per-workspace toggle → pacing rules → send. Best-effort.
 */
export async function runAutoReminders(
  limit = 25,
): Promise<{ sent: number; skipped: number; failed: number }> {
  const today = todayIsoDate();

  const candidates = await collections
    .documents()
    .find({
      deletedAt: null,
      type: { $in: ["invoice", "request"] },
      status: { $in: ["overdue", "sent", "viewed"] },
      $or: [
        { autoReminderCount: { $exists: false } },
        { autoReminderCount: { $lt: 3 } },
      ],
    })
    .limit(200)
    .toArray();

  const workspaceCache = new Map<string, Workspace>();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of candidates) {
    if (sent >= limit) break;

    const wsId = doc.workspaceId.toHexString();
    let workspace = workspaceCache.get(wsId);
    if (!workspace) {
      const found = await collections.workspaces().findOne({ _id: doc.workspaceId });
      if (!found) continue;
      workspace = found;
      workspaceCache.set(wsId, found);
    }
    if (!autoRemindersEnabled(workspace)) continue;

    const payments = await collections.payments().find({ documentId: doc._id }).toArray();
    const balance = balanceOf(doc.total, payments);
    const contact = doc.contactId
      ? await collections
          .contacts()
          .findOne({ _id: doc.contactId, workspaceId: doc.workspaceId })
      : null;
    const hasEmail = Boolean(contact?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email));

    const decision = shouldAutoRemind({
      type: doc.type,
      status: doc.status,
      balance,
      hasEmail,
      dueDate: doc.dueDate,
      lastReminderAt: doc.autoReminderAt ?? null,
      reminderCount: doc.autoReminderCount ?? 0,
      today,
    });
    if (!decision.due) {
      skipped += 1;
      continue;
    }

    const res = await sendReminderCore(workspace, doc._id, workspace.ownerUserId, {
      automatic: true,
    });
    if (res.ok) sent += 1;
    else failed += 1;
  }

  return { sent, skipped, failed };
}
