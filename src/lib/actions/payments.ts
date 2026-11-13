"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import {
  balanceOf,
  statusAfterPaymentRemoval,
} from "@/lib/finance";
import { recordPaymentForDocument } from "@/lib/payments-core";
import type { PaymentInput } from "@/lib/validation/schemas";
import type { DocumentStatus } from "@/lib/db/types";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";

export type ActionResult = { ok: boolean; error?: string; id?: string };

/** Document types that can receive payments. */
const PAYABLE_TYPES = ["invoice", "quote", "request"] as const;

export async function recordPaymentAction(
  documentId: string,
  input: PaymentInput,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(documentId);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const doc = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!doc) return { ok: false, error: "Document not found" };
    if (!(PAYABLE_TYPES as readonly string[]).includes(doc.type)) {
      return { ok: false, error: "Payments can only be recorded on bills, quotations and requests" };
    }

    const res = await recordPaymentForDocument({
      workspace,
      userId: user.id,
      documentId,
      input,
    });
    if (!res.ok) return res;

    revalidatePath(`/app/documents/${documentId}`);
    revalidatePath("/app/finance");
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to record payment",
    };
  }
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(paymentId);
    if (!objectId) return { ok: false, error: "Invalid payment id" };

    const payment = await collections
      .payments()
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!payment) return { ok: false, error: "Payment not found" };

    await collections.payments().deleteOne({ _id: objectId });

    const doc = await collections
      .documents()
      .findOne({ _id: payment.documentId, workspaceId: workspace._id });
    if (doc) {
      const remaining = await collections
        .payments()
        .find({ documentId: doc._id })
        .toArray();
      // Paid invoices drop off "paid" when a payment is removed (refund path).
      if (doc.status === "paid" && balanceOf(doc.total, remaining) > 0) {
        const next: DocumentStatus = statusAfterPaymentRemoval(
          remaining,
          doc.total,
          doc.dueDate,
        );
        await collections
          .documents()
          .updateOne(
            { _id: doc._id, workspaceId: workspace._id },
            { $set: { status: next, updatedAt: new Date() } },
          );
        await logActivity({
          workspaceId: workspace._id,
          documentId: doc._id,
          type: "status",
          message: `Payment removed — status paid → ${next}`,
          actor: user.id,
        });
      }
      await logActivity({
        workspaceId: workspace._id,
        documentId: doc._id,
        type: "payment",
        message: `Payment removed: ${formatMoney(payment.amount, doc.currency)}`,
        actor: user.id,
      });
      revalidatePath(`/app/documents/${doc._id.toHexString()}`);
    }

    revalidatePath("/app/finance");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to remove payment",
    };
  }
}
