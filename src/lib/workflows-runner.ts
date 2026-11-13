import { collections } from "@/lib/db/client";
import { isQuoteExpired, needsOverdueMark } from "@/lib/automation";
import { todayIsoDate } from "@/lib/utils";
import { notifyWorkspace } from "@/lib/notify";

/**
 * Cron pass for §8/§15 automatic status updates:
 *   - quotations past their validity expire (sent/viewed → expired)
 *   - invoices past their due date go overdue (sent/viewed → overdue)
 *
 * Both transitions are one-way gates enforced by VALID_TRANSITIONS; this
 * runner only applies them where the pure predicates match. Idempotent.
 */
export async function runWorkflowMaintenance(
  limit = 200,
): Promise<{ expired: number; overdue: number }> {
  const today = todayIsoDate();

  const quotes = await collections
    .documents()
    .find({
      deletedAt: null,
      type: "quote",
      status: { $in: ["sent", "viewed"] },
      dueDate: { $lt: today },
    })
    .limit(limit)
    .toArray();

  let expired = 0;
  for (const doc of quotes) {
    if (!isQuoteExpired(doc, today)) continue;
    const res = await collections.documents().updateOne(
      { _id: doc._id, status: doc.status },
      { $set: { status: "expired", updatedAt: new Date() } },
    );
    if (res.modifiedCount > 0) expired += 1;
  }

  const invoices = await collections
    .documents()
    .find({
      deletedAt: null,
      type: "invoice",
      status: { $in: ["sent", "viewed"] },
      dueDate: { $lt: today },
    })
    .limit(limit)
    .toArray();

  let overdue = 0;
  for (const doc of invoices) {
    if (!needsOverdueMark(doc, today)) continue;
    const res = await collections.documents().updateOne(
      { _id: doc._id, status: doc.status },
      { $set: { status: "overdue", updatedAt: new Date() } },
    );
    if (res.modifiedCount > 0) {
      overdue += 1;
      await notifyWorkspace({
        workspaceId: doc.workspaceId,
        type: "invoice_overdue",
        title: `Invoice ${doc.number} is overdue`,
        body: doc.dueDate ? `Was due ${doc.dueDate}` : undefined,
        href: `/app/documents/${doc._id.toHexString()}`,
      });
    }
  }

  return { expired, overdue };
}
