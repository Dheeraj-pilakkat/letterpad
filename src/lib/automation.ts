/**
 * Phase 5 — document workflow automation (pure helpers).
 *
 * Used by the cron runner to expire quotations, mark invoices overdue and
 * decide when an automatic payment reminder should go out. Kept pure so the
 * rules are unit-testable without Mongo or a clock.
 */

import type { DocumentStatus, DocumentType, Workspace } from "@/lib/db/types";

const DAY_MS = 86_400_000;

export interface DocStatusInput {
  type: DocumentType;
  status: DocumentStatus;
  dueDate?: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`).getTime() -
      new Date(`${fromIso}T00:00:00Z`).getTime()) /
      DAY_MS,
  );
}

/**
 * Quotations expire the day after their validity end (dueDate) while still
 * awaiting a client decision. Drafts and decided quotes never expire.
 */
export function isQuoteExpired(doc: DocStatusInput, today: string): boolean {
  if (doc.type !== "quote") return false;
  if (!["sent", "viewed"].includes(doc.status)) return false;
  if (!doc.dueDate) return false;
  return doc.dueDate < today;
}

/** Invoices past their due date move sent/viewed → overdue automatically. */
export function needsOverdueMark(doc: DocStatusInput, today: string): boolean {
  if (doc.type !== "invoice") return false;
  if (!["sent", "viewed"].includes(doc.status)) return false;
  if (!doc.dueDate) return false;
  return doc.dueDate < today;
}

/** A quotation becomes convertible to an invoice once it's out of draft. */
export function canConvertToInvoice(doc: {
  type: DocumentType;
  status: DocumentStatus;
}): boolean {
  return doc.type === "quote" && !["void", "rejected", "draft"].includes(doc.status);
}

/* ------------------------------------------------------------
   Automatic payment reminders
   ------------------------------------------------------------ */

export interface ReminderDecision {
  due: boolean;
  reason?: string;
}

export interface ReminderInput {
  /** invoice / payment request only */
  type: DocumentType;
  status: DocumentStatus;
  /** Outstanding balance in document currency */
  balance: number;
  /** Client email present and valid-ish */
  hasEmail: boolean;
  /** ISO date the document is/was due (requests use dueDate too) */
  dueDate?: string;
  /** Last automatic reminder sent (undefined = never) */
  lastReminderAt?: Date | string | null;
  /** How many automatic reminders cron already sent */
  reminderCount?: number;
  today: string;
  /** Minimum days between automatic reminders (default 7) */
  intervalDays?: number;
  /** Hard cap of automatic reminders per document (default 3) */
  maxReminders?: number;
}

/**
 * Decide whether cron should send an automatic payment reminder now.
 * Rules: outstanding balance, still unpaid, contact email present, past due
 * (or 7 days after send for undated docs), spaced by intervalDays, capped.
 */
export function shouldAutoRemind(input: ReminderInput): ReminderDecision {
  const {
    type,
    status,
    balance,
    hasEmail,
    dueDate,
    lastReminderAt,
    reminderCount = 0,
    today,
    intervalDays = 7,
    maxReminders = 3,
  } = input;

  if (!["invoice", "request"].includes(type)) {
    return { due: false, reason: "not-billable" };
  }
  if (["paid", "void", "draft"].includes(status)) {
    return { due: false, reason: "status" };
  }
  if (balance <= 0) return { due: false, reason: "paid" };
  if (!hasEmail) return { due: false, reason: "no-email" };
  if (reminderCount >= maxReminders) {
    return { due: false, reason: "max-reminders" };
  }

  const overdue = dueDate ? dueDate < today : false;
  if (dueDate && !overdue) return { due: false, reason: "not-due" };

  if (lastReminderAt) {
    const last =
      typeof lastReminderAt === "string"
        ? lastReminderAt.slice(0, 10)
        : lastReminderAt.toISOString().slice(0, 10);
    const since = daysBetween(last, today);
    if (since < intervalDays) return { due: false, reason: "interval" };
  } else if (!dueDate) {
    // Undated bills only remind once past a week old — nothing to judge by.
    return { due: false, reason: "no-due-date" };
  }

  return { due: true };
}

/** Workspace toggle: unset means enabled (opt-out). */
export function autoRemindersEnabled(workspace: Pick<Workspace, "autoRemindersEnabled">): boolean {
  return workspace.autoRemindersEnabled !== false;
}

/* ------------------------------------------------------------
   Scheduled delivery
   ------------------------------------------------------------ */

/** A queued delivery fires once its sendAt has passed (UTC). */
export function isDeliveryDue(sendAt: string, now: Date = new Date()): boolean {
  const at = Date.parse(sendAt);
  if (Number.isNaN(at)) return false;
  return at <= now.getTime();
}

/** Schedule window: must be in the future and within 90 days. */
export function validateSendAt(
  sendAt: string,
  now: Date = new Date(),
): { ok: boolean; error?: string } {
  const at = Date.parse(sendAt);
  if (Number.isNaN(at)) return { ok: false, error: "Pick a valid date and time" };
  if (at <= now.getTime()) {
    return { ok: false, error: "Delivery time must be in the future" };
  }
  if (at > now.getTime() + 90 * DAY_MS) {
    return { ok: false, error: "Scheduled delivery must be within 90 days" };
  }
  return { ok: true };
}
