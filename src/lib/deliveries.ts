import { logActivity } from "@/lib/activity";
import { collections } from "@/lib/db/client";
import { documentLinkFor } from "@/lib/document-link";
import { sendEmail } from "@/lib/share";
import { isDeliveryDue } from "@/lib/automation";

/**
 * Cron pass: send documents queued for scheduled delivery (§15).
 * A delivery only completes when Resend is configured — cron cannot open
 * mailto drafts, so unconfigured sends are marked failed with a clear error.
 */
export async function runDueDeliveries(
  limit = 50,
): Promise<{ sent: number; failed: number }> {
  const now = new Date();
  const due = await collections
    .deliveries()
    .find({ status: "pending", sendAt: { $lte: now.toISOString() } })
    .sort({ sendAt: 1 })
    .limit(limit)
    .toArray();

  let sent = 0;
  let failed = 0;

  for (const delivery of due) {
    if (!isDeliveryDue(delivery.sendAt, now)) continue;

    const outcome = await deliverOnce(delivery._id);
    if (outcome) sent += 1;
    else failed += 1;
  }

  return { sent, failed };
}

/** Send one queued delivery; marks it sent/failed. Returns true when sent. */
async function deliverOnce(deliveryId: { toHexString(): string }): Promise<boolean> {
  const delivery = await collections
    .deliveries()
    .findOne({ _id: deliveryId as never, status: "pending" });
  if (!delivery) return false;

  const fail = async (error: string): Promise<boolean> => {
    await collections.deliveries().updateOne(
      { _id: delivery._id },
      {
        $set: { status: "failed", error, updatedAt: new Date() },
      },
    );
    return false;
  };

  const doc = await collections
    .documents()
    .findOne({ _id: delivery.documentId, deletedAt: null });
  if (!doc) return fail("Document no longer exists");

  const workspace = await collections
    .workspaces()
    .findOne({ _id: delivery.workspaceId });
  if (!workspace) return fail("Workspace no longer exists");

  const contact = doc.contactId
    ? await collections
        .contacts()
        .findOne({ _id: doc.contactId, workspaceId: workspace._id })
    : null;

  const url = await documentLinkFor(doc, contact);
  const subject =
    delivery.subject?.trim() || `${doc.number} from ${workspace.name}`;
  const custom = delivery.message?.trim();
  const text = custom
    ? `${custom}\n\nView online: ${url}`
    : `Hello,\n\nPlease find ${doc.number} from ${workspace.name}.\n\nView online: ${url}\n\nThank you.`;

  const result = await sendEmail({ to: delivery.to, subject, text });

  if (!result.ok || result.mode !== "resend") {
    return fail(
      result.ok
        ? "Email delivery not configured (set RESEND_API_KEY)"
        : (result.error ?? "Email send failed"),
    );
  }

  await collections.deliveries().updateOne(
    { _id: delivery._id },
    {
      $set: { status: "sent", sentAt: new Date(), error: undefined, updatedAt: new Date() },
      $unset: { error: "" },
    },
  );
  await logActivity({
    workspaceId: workspace._id,
    documentId: doc._id,
    type: "emailed",
    message: `Scheduled delivery sent to ${delivery.to}`,
    actor: delivery.createdBy || "system",
  });
  return true;
}
