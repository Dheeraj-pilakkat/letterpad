import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import type { NotificationType } from "@/lib/db/types";

export type { NotificationType };
export { NOTIFICATION_LABELS } from "@/lib/constants";

const DAY_MS = 86_400_000;
/** Notify owners this many days before a share link expires. */
export const SHARE_EXPIRY_NOTICE_DAYS = 3;

export interface NotifyInput {
  workspaceId: ObjectId;
  type: NotificationType;
  title: string;
  body?: string;
  /** In-app link target (absolute path) */
  href?: string;
  /** Override recipients — defaults to the workspace owner + members. */
  userIds?: string[];
}

async function defaultRecipients(workspaceId: ObjectId): Promise<string[]> {
  const ws = await collections.workspaces().findOne({ _id: workspaceId });
  if (!ws) return [];
  const ids = [ws.ownerUserId, ...(ws.members?.map((m) => m.userId) ?? [])];
  return [...new Set(ids)];
}

/**
 * Best-effort in-app notification (§11.3). Never throws — notification
 * delivery must not break the business flow that triggered it.
 */
export async function notifyWorkspace(input: NotifyInput): Promise<void> {
  try {
    const userIds = input.userIds ?? (await defaultRecipients(input.workspaceId));
    if (userIds.length === 0) return;
    const now = new Date();
    await collections.notifications().insertMany(
      userIds.map((userId) => ({
        _id: new ObjectId(),
        workspaceId: input.workspaceId,
        userId,
        type: input.type,
        title: input.title,
        ...(input.body ? { body: input.body } : {}),
        ...(input.href ? { href: input.href } : {}),
        readAt: null,
        createdAt: now,
      })),
      { ordered: false },
    );
  } catch {
    /* best-effort */
  }
}

export interface NotificationListItem {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationListItem[];
  unread: number;
}

/** Latest notifications for one user plus the true unread count. */
export async function listNotifications(
  userId: string,
  limit = 20,
): Promise<NotificationList> {
  const [rows, unread] = await Promise.all([
    collections
      .notifications()
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray(),
    collections.notifications().countDocuments({ userId, readAt: null }),
  ]);
  return {
    items: rows.map((n) => ({
      id: n._id.toHexString(),
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      createdAt: new Date(n.createdAt).toISOString(),
    })),
    unread,
  };
}

/**
 * Cron step: notify workspace owners once per share-link generation when the
 * link expires within SHARE_EXPIRY_NOTICE_DAYS. Idempotent — the doc carries
 * `shareExpiryNotifiedAt` equal to the expiry it was notified for.
 */
export async function runShareExpiryNotifications(): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + SHARE_EXPIRY_NOTICE_DAYS * DAY_MS);
  const docs = await collections
    .documents()
    .find({
      deletedAt: null,
      shareEnabled: true,
      shareToken: { $exists: true },
      shareExpiresAt: { $gt: now, $lte: horizon },
      $expr: {
        $or: [
          { $eq: [{ $ifNull: ["$shareExpiryNotifiedAt", null] }, null] },
          { $lt: ["$shareExpiryNotifiedAt", "$shareExpiresAt"] },
        ],
      },
    })
    .limit(100)
    .toArray();

  let notified = 0;
  for (const doc of docs) {
    const expiresAt = new Date(doc.shareExpiresAt as Date);
    await notifyWorkspace({
      workspaceId: doc.workspaceId,
      type: "document_expiring",
      title: `Share link for ${doc.number} expires soon`,
      body: `Expires ${expiresAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} — open the document to refresh it.`,
      href: `/app/documents/${doc._id.toHexString()}`,
    });
    await collections
      .documents()
      .updateOne(
        { _id: doc._id },
        { $set: { shareExpiryNotifiedAt: expiresAt } },
      );
    notified += 1;
  }
  return notified;
}
