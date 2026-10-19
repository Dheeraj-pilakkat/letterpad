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

export type ActionResult = { ok: boolean; error?: string; id?: string };

export async function createDocumentAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireWorkspace();
  const type = String(formData.get("type") ?? "") as DocumentType;
  const templateId = String(formData.get("templateId") ?? "");

  const template = templateById(templateId);
  if (!template || template.type !== type) {
    redirect("/app/documents/new");
  }

  const number = await nextDocumentNumber(workspace._id.toHexString(), type);
  const now = new Date();

  const result = await collections.documents().insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    type,
    templateId,
    number,
    status: "draft",
    title: "",
    contactId: null,
    issueDate: todayIsoDate(),
    currency: workspace.currency,
    items: [],
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    content: { subject: "", body: "", terms: "" },
    layout: {
      ...template.layout,
      accentColor: workspace.brandColors?.[0] ?? workspace.brandColor,
    },
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/app/documents");
  redirect(`/app/documents/${result.insertedId.toHexString()}`);
}

export async function updateDocument(
  id: string,
  payload: DocumentInput,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
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

    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!existing) return { ok: false, error: "Document not found" };

    const itemized = template.kind === "itemized";
    const customColumns =
      data.customColumns ?? existing.layout.customColumns ?? [];
    const activeColumnIds = new Set(customColumns.map((c) => c.id));
    const items = itemized
      ? data.items.map((item) => {
          // keep only values for columns that still exist
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
            ...(values && Object.keys(values).length > 0 ? { values } : {}),
          };
        })
      : [];
    const { subtotal, taxTotal, total } = computeTotals(items);

    await collections.documents().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          title: data.title || "",
          templateId: data.templateId,
          layout: {
            ...template.layout,
            accentColor: data.accentColor ?? workspace.brandColor,
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
          subtotal,
          taxTotal,
          total,
          updatedAt: new Date(),
        },
      },
    );

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
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };

    const existing = await collections
      .documents()
      .findOne({ _id: objectId, workspaceId: workspace._id });
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
      .findOne({ _id: objectId, workspaceId: workspace._id });
    if (!existing) return { ok: false, error: "Document not found" };

    const number = await nextDocumentNumber(
      workspace._id.toHexString(),
      existing.type,
    );
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: _oldId, ...rest } = existing;
    const result = await collections.documents().insertOne({
      _id: new ObjectId(),
      ...rest,
      number,
      status: "draft",
      issueDate: todayIsoDate(),
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath("/app/documents");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to duplicate" };
  }
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid document id" };
    await collections
      .documents()
      .deleteOne({ _id: objectId, workspaceId: workspace._id });
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

export async function saveDocumentFromEditor(
  id: string,
  payload: unknown,
): Promise<ActionResult> {
  return updateDocument(id, payload as DocumentInput);
}
