"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { logActivity } from "@/lib/activity";
import { nextDocumentNumber } from "@/lib/counters";
import { numberingConfig } from "@/lib/recurring";
import { computeTotals } from "@/lib/validation/schemas";
import { canConvertToInvoice } from "@/lib/automation";
import { resolveGst } from "@/lib/finance";
import { templateById, templatesForType } from "@/lib/templates/registry";
import { todayIsoDate } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/documents";
import type { DocumentItem, TemplateLayout } from "@/lib/db/types";
import { loadProfileForDoc } from "@/lib/profiles";
import { overlayBranding } from "@/lib/branding";

/** Invoice template matching the quotation's style (quote-classic → invoice-classic). */
function invoiceTemplateId(quoteTemplateId: string): string {
  const candidate = quoteTemplateId.replace(/^quote-/, "invoice-");
  if (templateById(candidate)?.type === "invoice") return candidate;
  return templatesForType("invoice")[0]?.id ?? quoteTemplateId;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * §15 quotation-to-payment workflow step 4: convert an accepted quotation
 * into a draft invoice (items, client, discount and style carried over).
 */
export async function convertToInvoiceAction(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid quotation id" };

    const quote = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!quote) return { ok: false, error: "Quotation not found" };
    if (!canConvertToInvoice(quote)) {
      return { ok: false, error: "Only a sent quotation can become an invoice" };
    }

    const existing = await collections.documents().findOne({
      workspaceId: workspace._id,
      convertedFromId: quote._id,
      deletedAt: null,
      status: { $ne: "void" },
    });
    if (existing) {
      return {
        ok: false,
        error: `Already converted to ${existing.number}`,
        id: existing._id.toHexString(),
      };
    }

    const templateId = invoiceTemplateId(quote.templateId);
    const template = templateById(templateId);
    if (!template || template.type !== "invoice") {
      return { ok: false, error: "No invoice template available" };
    }

    // §6: converted invoice inherits the quotation's business profile.
    const profile = await loadProfileForDoc(quote);
    const brand = overlayBranding(workspace, profile);
    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      "invoice",
      numberingConfig(brand, "invoice"),
      profile?._id.toHexString(),
    );

    const items: DocumentItem[] = quote.items.map((item) => ({ ...item }));
    const discount = quote.discount ? { ...quote.discount } : undefined;
    const totals = computeTotals(items, discount);
    const now = new Date();
    const issueDate = todayIsoDate();

    const contact = quote.contactId
      ? await collections
          .contacts()
          .findOne({ _id: quote.contactId, workspaceId: workspace._id })
      : null;
    const gst = resolveGst({
      enabled: brand.gstEnabled === true,
      taxTotal: totals.taxTotal,
      placeOfSupply: brand.placeOfSupply,
      workspaceState: brand.state,
      workspaceCountry: brand.country,
      contactState: contact?.state,
      contactCountry: contact?.country,
    });

    const layout: TemplateLayout = {
      ...template.layout,
      accentColor: quote.layout.accentColor ?? brand.brandColor,
      columns: quote.layout.columns ?? template.layout.columns,
      customColumns: quote.layout.customColumns ?? [],
    };

    const insert = await collections.documents().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      ...(profile ? { profileId: profile._id } : {}),
      type: "invoice",
      templateId,
      number,
      status: "draft",
      title: quote.title || "",
      contactId: quote.contactId,
      issueDate,
      dueDate: addDays(issueDate, 15),
      currency: quote.currency,
      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      discount,
      convertedFromId: quote._id,
      ...(gst ? { gst } : {}),
      content: { ...quote.content },
      layout,
      createdBy: user.id,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    await logActivity({
      workspaceId: workspace._id,
      documentId: insert.insertedId,
      type: "created",
      message: `Converted from quotation ${quote.number}`,
      actor: user.id,
    });
    await logActivity({
      workspaceId: workspace._id,
      documentId: quote._id,
      type: "status",
      message: `Converted to invoice ${number}`,
      actor: user.id,
    });

    revalidatePath("/app/documents");
    revalidatePath(`/app/documents/${id}`);
    return { ok: true, id: insert.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to convert quotation",
    };
  }
}

/** Toggle cron-driven automatic payment reminders for this workspace. */
export async function setAutoRemindersAction(
  enabled: boolean,
): Promise<ActionResult> {
  try {
    const { workspace, role } = await requireWorkspace();
    if (role === "member") {
      return { ok: false, error: "Only owners and admins can change automation" };
    }

    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $set: { autoRemindersEnabled: Boolean(enabled), updatedAt: new Date() } },
    );
    revalidatePath("/app/recurring");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update automation setting",
    };
  }
}
