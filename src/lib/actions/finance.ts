"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { nextDocumentNumber } from "@/lib/counters";
import { balanceOf, notePayload, paymentRequestPayload } from "@/lib/finance";
import { numberingConfig } from "@/lib/recurring";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/utils";
import { loadProfileForDoc } from "@/lib/profiles";
import { overlayBranding } from "@/lib/branding";

export type ActionResult = { ok: boolean; error?: string; id?: string };

/** Create a payment-request document for the outstanding balance of an invoice. */
export async function createPaymentRequestAction(
  invoiceId: string,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(invoiceId);
    if (!objectId) return { ok: false, error: "Invalid invoice id" };

    const invoice = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.type !== "invoice") {
      return { ok: false, error: "Payment requests are issued against bills" };
    }

    const payments = await collections.payments().find({ documentId: objectId }).toArray();
    const balance = balanceOf(invoice.total, payments);
    if (balance <= 0) return { ok: false, error: "This bill is fully paid" };

    // §6: inherit the invoice's business profile (branding + sequence).
    const profile = await loadProfileForDoc(invoice);
    const brand = overlayBranding(workspace, profile);
    const payload = paymentRequestPayload(invoice, balance);
    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      "request",
      numberingConfig(brand, "request"),
      profile?._id.toHexString(),
    );
    const now = new Date();
    const result = await collections.documents().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      ...(profile ? { profileId: profile._id } : {}),
      ...payload,
      number,
      contactId: payload.contactId ? new ObjectId(payload.contactId) : null,
      layout: {
        ...(invoice.layout ?? {}),
        accentColor: brand.brandColors?.[0] ?? brand.brandColor,
      },
      createdBy: user.id,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "payment",
      message: `Payment requested: ${formatMoney(balance, invoice.currency)} (${number})`,
      actor: user.id,
    });
    await logActivity({
      workspaceId: workspace._id,
      documentId: result.insertedId,
      type: "created",
      message: `Created from ${invoice.number}`,
      actor: user.id,
    });

    revalidatePath("/app/documents");
    revalidatePath("/app/finance");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create payment request",
    };
  }
}

/** Issue a credit or debit note that mirrors an invoice. */
export async function createNoteAction(
  invoiceId: string,
  kind: "creditNote" | "debitNote",
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(invoiceId);
    if (!objectId) return { ok: false, error: "Invalid invoice id" };

    const invoice = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!invoice) return { ok: false, error: "Invoice not found" };
    if (invoice.type !== "invoice") {
      return { ok: false, error: "Notes are issued against bills" };
    }

    // §6: notes inherit the invoice's business profile (branding + sequence).
    const profile = await loadProfileForDoc(invoice);
    const brand = overlayBranding(workspace, profile);
    const payload = notePayload(invoice, kind);
    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      kind,
      numberingConfig(brand, kind),
      profile?._id.toHexString(),
    );
    const now = new Date();
    const result = await collections.documents().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      ...(profile ? { profileId: profile._id } : {}),
      ...payload,
      number,
      contactId: payload.contactId ? new ObjectId(payload.contactId) : null,
      ...(invoice.gst ? { gst: invoice.gst } : {}),
      createdBy: user.id,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "payment",
      message: `${kind === "creditNote" ? "Credit" : "Debit"} note ${number} issued`,
      actor: user.id,
    });
    await logActivity({
      workspaceId: workspace._id,
      documentId: result.insertedId,
      type: "created",
      message: `Created against ${invoice.number}`,
      actor: user.id,
    });

    revalidatePath("/app/documents");
    revalidatePath("/app/finance");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to issue note",
    };
  }
}
