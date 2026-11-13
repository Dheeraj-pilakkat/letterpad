import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import { balanceOf, statusAfterPayment } from "@/lib/finance";
import { paymentSchema, type PaymentInput } from "@/lib/validation/schemas";
import type { Workspace } from "@/lib/db/types";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";
import { sendEmail } from "@/lib/share";
import { paymentConfirmationEmail } from "@/lib/signature";

export type PaymentResult = { ok: boolean; error?: string; id?: string };

/**
 * Shared payment recorder used by the server action and the Razorpay
 * verify/webhook routes. Validates the input, caps it at the outstanding
 * balance, inserts the payment and flips the document status when settled.
 */
export async function recordPaymentForDocument(opts: {
  workspace: Workspace;
  userId: string;
  documentId: string;
  input: PaymentInput;
}): Promise<PaymentResult> {
  const { workspace, userId, documentId, input } = opts;

  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid payment" };
  }
  const data = parsed.data;

  const target = await collections
    .documents()
    .findOne({ _id: new ObjectId(documentId), workspaceId: workspace._id, deletedAt: null });
  if (!target) return { ok: false, error: "Document not found" };

  const existing = await collections.payments().find({ documentId: target._id }).toArray();
  const balance = balanceOf(target.total, existing);
  if (data.amount > balance + 0.005) {
    return {
      ok: false,
      error: `Amount exceeds the outstanding balance of ${formatMoney(balance, target.currency)}`,
    };
  }
  if (balance <= 0) {
    return { ok: false, error: "This document is fully paid" };
  }

  const now = new Date();
  const result = await collections.payments().insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    documentId: target._id,
    amount: data.amount,
    date: data.date,
    method: data.method,
    reference: data.reference || undefined,
    notes: data.notes || undefined,
    refunded: false,
    createdAt: now,
  });

  const after = [...existing, { amount: data.amount, refunded: false }];
  const implied = statusAfterPayment(target.total, after, target.status);
  if (implied !== target.status) {
    await collections
      .documents()
      .updateOne(
        { _id: target._id, workspaceId: workspace._id },
        { $set: { status: implied, updatedAt: now } },
      );
    await logActivity({
      workspaceId: workspace._id,
      documentId: target._id,
      type: "status",
      message: `Status ${target.status} → ${implied} (fully paid)`,
      actor: userId,
    });
  }

  await logActivity({
    workspaceId: workspace._id,
    documentId: target._id,
    type: "payment",
    message: `Payment recorded: ${formatMoney(data.amount, target.currency)} via ${data.method}`,
    actor: userId,
  });

  // Best-effort payment confirmation to the client (only when Resend is live)
  try {
    const contact = target.contactId
      ? await collections
          .contacts()
          .findOne({ _id: target.contactId, workspaceId: workspace._id })
      : null;
    const to = contact?.email?.trim();
    if (to && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      const remaining = Math.max(
        0,
        Math.round(balanceOf(target.total, after) * 100) / 100,
      );
      const paid = Math.round(data.amount * 100) / 100;
      const { subject, text } = paymentConfirmationEmail({
        workspaceName: workspace.name,
        docNumber: target.number,
        amount: paid,
        currency: target.currency,
        date: data.date,
        remaining,
        contactName: contact?.name,
      });
      const mail = await sendEmail({ to, subject, text });
      if (mail.ok && mail.mode === "resend") {
        await logActivity({
          workspaceId: workspace._id,
          documentId: target._id,
          type: "emailed",
          message: `Payment confirmation emailed to ${to}`,
          actor: userId,
        });
      }
    }
  } catch {
    // never fail the payment because of an email
  }

  return { ok: true, id: result.insertedId.toHexString() };
}
