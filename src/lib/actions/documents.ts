"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { nextDocumentNumber } from "@/lib/counters";
import {
  computeTotals,
  documentSchema,
  type DocumentInput,
} from "@/lib/validation/schemas";
import { templateById } from "@/lib/templates/registry";
import type { DocumentStatus, DocumentType } from "@/lib/db/types";
import { todayIsoDate } from "@/lib/utils";
import { VALID_TRANSITIONS } from "@/lib/constants";
import { logActivity } from "@/lib/activity";
import { numberingConfig } from "@/lib/recurring";
import { resolveGst } from "@/lib/finance";
import { checkDocumentQuota, checkTemplateAccess } from "@/lib/plans";
import { countDocumentsThisMonth } from "@/lib/documents-quota";
import { queueWebhook } from "@/lib/webhooks";
import { getActiveProfile, loadProfileForDoc } from "@/lib/profiles";
import { overlayBranding } from "@/lib/branding";

export type ActionResult = { ok: boolean; error?: string; id?: string };

export async function createDocumentAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireWorkspace();
  const type = String(formData.get("type") ?? "") as DocumentType;
  const templateId = String(formData.get("templateId") ?? "");

  const template = templateById(templateId);
  if (!template || template.type !== type) {
    redirect("/app/documents/new");
  }

  // §20 plan gates: premium templates + monthly document quota.
  const access = checkTemplateAccess(workspace, template);
  if (!access.ok) {
    redirect(`/app/documents/new?type=${type}&error=${encodeURIComponent(access.error ?? "Locked")}`);
  }
  const quota = checkDocumentQuota(workspace, await countDocumentsThisMonth(workspace._id));
  if (!quota.ok) {
    redirect(`/app/documents/new?type=${type}&error=${encodeURIComponent(quota.error ?? "Limit reached")}`);
  }

  // §6: stamp the active business profile (if any) — its branding and
  // numbering sequence apply to the new document.
  const profile = await getActiveProfile(workspace._id);
  const brand = overlayBranding(workspace, profile);

  const number = await nextDocumentNumber(
    workspace._id.toHexString(),
    type,
    numberingConfig(brand, type),
    profile?._id.toHexString(),
  );
  const now = new Date();

  const result = await collections.documents().insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    ...(profile ? { profileId: profile._id } : {}),
    type,
    templateId,
    number,
    status: "draft",
    title: "",
    contactId: null,
    issueDate: todayIsoDate(),
    currency: brand.currency,
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0,
    content: { subject: "", body: "", terms: "" },
    layout: {
      ...template.layout,
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
    documentId: result.insertedId,
    type: "created",
    message: `Created ${type} ${number}`,
    actor: user.id,
  });

  queueWebhook(workspace._id, "document.created", {
    id: result.insertedId.toHexString(),
    number,
    type,
    status: "draft",
    total: 0,
    currency: brand.currency,
  });

  revalidatePath("/app/documents");
  redirect(`/app/documents/${result.insertedId.toHexString()}`);
}

export async function updateDocument(
  id: string,
  payload: DocumentInput,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const parsed = documentSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid document",
      };
    }
    const data = parsed.data;

    const template = templateById(data.templateId);
    if (!template) return { ok: false, error: "Unknown template" };
    const access = checkTemplateAccess(workspace, template);
    if (!access.ok) return { ok: false, error: access.error ?? "Template locked" };

    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!existing) return { ok: false, error: "Document not found" };

    const itemized = template.kind === "itemized";
    const customColumns =
      data.customColumns ?? existing.layout.customColumns ?? [];
    const activeColumnIds = new Set(customColumns.map((c) => c.id));
    const items = itemized
      ? data.items.map((item) => {
          const values = item.values
            ? Object.fromEntries(
                Object.entries(item.values).filter(([id]) =>
                  activeColumnIds.has(id),
                ),
              )
            : undefined;
          return {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
            ...(item.hsn ? { hsn: item.hsn } : {}),
            ...(values && Object.keys(values).length > 0 ? { values } : {}),
          };
        })
      : [];
    const discount = data.discount ?? undefined;
    const { subtotal, discountTotal, taxTotal, total } = computeTotals(
      items,
      discount,
    );

    const contact = data.contactId
      ? await collections
          .contacts()
          .findOne({ _id: new ObjectId(data.contactId), workspaceId: workspace._id })
      : null;
    // §6: GST settings come from the document's business profile when set.
    const brand = overlayBranding(workspace, await loadProfileForDoc(existing));
    const gst = resolveGst({
      enabled: brand.gstEnabled === true,
      taxTotal,
      placeOfSupply: brand.placeOfSupply,
      workspaceState: brand.state,
      workspaceCountry: brand.country,
      contactState: contact?.state,
      contactCountry: contact?.country,
    });

    // §16: RCM only exists while GST is enabled for this brand.
    const reverseCharge = brand.gstEnabled === true && data.reverseCharge === true;
    const unset: Record<string, ""> = {};
    if (!gst) unset.gst = "";
    if (!reverseCharge) unset.reverseCharge = "";

    await collections.documents().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          title: data.title || "",
          templateId: data.templateId,
          layout: {
            ...template.layout,
            accentColor: data.accentColor ?? brand.brandColor,
            columns: data.columns ?? existing.layout.columns,
            customColumns,
          },
          contactId: data.contactId ? new ObjectId(data.contactId) : null,
          issueDate: data.issueDate,
          dueDate: data.dueDate || undefined,
          currency: data.currency,
          content: {
            subject: data.content.subject || "",
            body: data.content.body || "",
            terms: data.content.terms || "",
          },
          items,
          discount,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          ...(gst ? { gst } : {}),
          ...(reverseCharge ? { reverseCharge: true } : {}),
          updatedAt: new Date(),
        },
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
    );

    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "updated",
      message: "Document edited",
      actor: user.id,
    });

    revalidatePath("/app/documents");
    revalidatePath(`/app/documents/${id}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save document",
    };
  }
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!existing) return { ok: false, error: "Document not found" };

    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      return {
        ok: false,
        error: `Cannot move from ${existing.status} to ${status}`,
      };
    }

    await collections
      .documents()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { status, updatedAt: new Date() } },
      );
    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "status",
      message: `Status ${existing.status} → ${status}`,
      actor: user.id,
    });
    queueWebhook(workspace._id, "document.status_changed", {
      id: objectId.toHexString(),
      number: existing.number,
      type: existing.type,
      from: existing.status,
      to: status,
      total: existing.total,
      currency: existing.currency,
    });
    revalidatePath(`/app/documents/${id}`);
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to update status",
    };
  }
}

export async function duplicateDocument(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };
    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!existing) return { ok: false, error: "Document not found" };

    // §6: duplicate keeps the source document's profile (and its sequence).
    const dupProfile = await loadProfileForDoc(existing);
    const dupBrand = overlayBranding(workspace, dupProfile);
    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      existing.type,
      numberingConfig(dupBrand, existing.type),
      dupProfile?._id.toHexString(),
    );
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: _oldId, shareToken: _st, shareEnabled: _se, shareExpiresAt: _sxa, shareExpiryNotifiedAt: _sna, ...rest } = existing;
    const result = await collections.documents().insertOne({
      _id: new ObjectId(),
      ...rest,
      number,
      status: "draft",
      issueDate: todayIsoDate(),
      createdBy: user.id,
      deletedAt: null,
      shareEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity({
      workspaceId: workspace._id,
      documentId: result.insertedId,
      type: "duplicated",
      message: `Duplicated from ${existing.number}`,
      actor: user.id,
    });
    revalidatePath("/app/documents");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to duplicate" };
  }
}

/** Soft-delete: moves the document to trash (recoverable). */
export async function deleteDocument(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };
    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: null });
    if (!existing) return { ok: false, error: "Document not found" };

    await collections
      .documents()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        {
          $set: {
            deletedAt: new Date(),
            shareEnabled: false,
            updatedAt: new Date(),
          },
          $unset: { shareToken: "", shareExpiresAt: "", shareExpiryNotifiedAt: "" },
        },
      );
    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "trashed",
      message: `Moved ${existing.number} to trash`,
      actor: user.id,
    });
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

export async function restoreDocument(id: string): Promise<ActionResult> {
  try {
    const { workspace, user } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };
    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id, deletedAt: { $ne: null } });
    if (!existing) return { ok: false, error: "Trashed document not found" };

    await collections
      .documents()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { deletedAt: null, updatedAt: new Date() } },
      );
    await logActivity({
      workspaceId: workspace._id,
      documentId: objectId,
      type: "restored",
      message: `Restored ${existing.number} from trash`,
      actor: user.id,
    });
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore" };
  }
}

export async function saveDocumentFromEditor(
  id: string,
  payload: unknown,
): Promise<ActionResult> {
  return updateDocument(id, payload as DocumentInput);
}
