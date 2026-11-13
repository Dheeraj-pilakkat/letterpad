import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { authenticateApiKey, apiError } from "@/lib/api-auth";
import { apiDocument } from "@/lib/api-serialize";
import { collections } from "@/lib/db/client";
import { templateById } from "@/lib/templates/registry";
import { checkDocumentQuota, checkTemplateAccess } from "@/lib/plans";
import { countDocumentsThisMonth } from "@/lib/documents-quota";
import { nextDocumentNumber } from "@/lib/counters";
import { numberingConfig } from "@/lib/recurring";
import { logActivity } from "@/lib/activity";
import { todayIsoDate } from "@/lib/utils";
import type { DocumentType } from "@/lib/db/types";

const DOCUMENT_TYPES: DocumentType[] = [
  "letter",
  "quote",
  "invoice",
  "receipt",
  "request",
  "creditNote",
  "debitNote",
];

/** GET /api/v1/documents — list documents (page/limit/type/status filters). */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.error);

  const { workspace } = auth;
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");

  const filter: Record<string, unknown> = {
    workspaceId: workspace._id,
    deletedAt: null,
  };
  if (type && DOCUMENT_TYPES.includes(type as DocumentType)) filter.type = type;
  if (status) filter.status = status;

  const docs = await collections
    .documents()
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return NextResponse.json({
    data: docs.map(apiDocument),
    page,
    limit,
    hasMore: docs.length === limit,
  });
}

interface CreateBody {
  type?: string;
  templateId?: string;
  title?: string;
  issueDate?: string;
  contactId?: string;
}

/** POST /api/v1/documents — create a draft (quota + plan gates apply). */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.error);
  const { workspace } = auth;

  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const type = body?.type as DocumentType | undefined;
  if (!type || !DOCUMENT_TYPES.includes(type)) {
    return apiError(400, "Invalid or missing `type`");
  }

  const template = body?.templateId ? templateById(body.templateId) : undefined;
  if (!template || template.type !== type) {
    return apiError(400, "Unknown or mismatched `templateId` for this type");
  }

  const access = checkTemplateAccess(workspace, template);
  if (!access.ok) return apiError(402, access.error ?? "Template locked on this plan");

  const quota = checkDocumentQuota(
    workspace,
    await countDocumentsThisMonth(workspace._id),
  );
  if (!quota.ok) return apiError(402, quota.error ?? "Monthly document limit reached");

  const issueDate =
    body?.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(body.issueDate)
      ? body.issueDate
      : todayIsoDate();

  let contactId: ObjectId | null = null;
  if (body?.contactId) {
    if (!/^[0-9a-fA-F]{24}$/.test(body.contactId)) {
      return apiError(400, "Invalid contactId");
    }
    const contact = await collections.contacts().findOne({
      _id: new ObjectId(body.contactId),
      workspaceId: workspace._id,
    });
    if (!contact) return apiError(404, "Contact not found");
    contactId = contact._id;
  }

  const number = await nextDocumentNumber(
    workspace._id.toHexString(),
    type,
    numberingConfig(workspace, type),
  );
  const now = new Date();

  const result = await collections.documents().insertOne({
    _id: new ObjectId(),
    workspaceId: workspace._id,
    type,
    templateId: template.id,
    number,
    status: "draft",
    title: body?.title ?? "",
    contactId,
    issueDate,
    currency: workspace.currency,
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    total: 0,
    content: { subject: "", body: "", terms: "" },
    layout: {
      ...template.layout,
      accentColor: workspace.brandColors?.[0] ?? workspace.brandColor,
    },
    createdBy: "api",
    deletedAt: null,
    shareEnabled: false,
    createdAt: now,
    updatedAt: now,
  });

  await logActivity({
    workspaceId: workspace._id,
    documentId: result.insertedId,
    type: "created",
    message: `Created ${type} ${number} via API`,
    actor: "api",
  });

  const created = await collections
    .documents()
    .findOne({ _id: result.insertedId as ObjectId });
  return NextResponse.json({ data: created ? apiDocument(created) : null }, { status: 201 });
}
