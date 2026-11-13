import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { authenticateApiKey, apiError } from "@/lib/api-auth";
import { apiContact } from "@/lib/api-serialize";
import { collections } from "@/lib/db/client";

/** GET /api/v1/contacts — list contacts. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.error);

  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const archived = url.searchParams.get("archived") === "true";

  const contacts = await collections
    .contacts()
    .find({ workspaceId: auth.workspace._id, archived })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return NextResponse.json({ data: contacts.map(apiContact), limit });
}

interface CreateContactBody {
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  country?: string;
  taxId?: string;
}

/** POST /api/v1/contacts — create a contact. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.error);

  const body = (await request.json().catch(() => null)) as CreateContactBody | null;
  const name = body?.name?.trim();
  if (!name || name.length > 120) return apiError(400, "Invalid or missing `name`");
  if (body?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return apiError(400, "Invalid `email`");
  }

  const now = new Date();
  const result = await collections.contacts().insertOne({
    _id: new ObjectId(),
    workspaceId: auth.workspace._id,
    name,
    companyName: body?.companyName?.trim() || undefined,
    email: body?.email?.trim() || undefined,
    phone: body?.phone?.trim() || undefined,
    country: body?.country?.trim() || undefined,
    taxId: body?.taxId?.trim() || undefined,
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  const created = await collections
    .contacts()
    .findOne({ _id: result.insertedId as ObjectId });
  return NextResponse.json(
    { data: created ? apiContact(created) : null },
    { status: 201 },
  );
}
