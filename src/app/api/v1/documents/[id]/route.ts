import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { authenticateApiKey, apiError } from "@/lib/api-auth";
import { apiDocument } from "@/lib/api-serialize";
import { collections } from "@/lib/db/client";

/** GET /api/v1/documents/[id] — fetch one document. */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) return apiError(auth.status, auth.error);

  const { id } = await ctx.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) return apiError(400, "Invalid document id");

  const doc = await collections.documents().findOne({
    _id: new ObjectId(id),
    workspaceId: auth.workspace._id,
    deletedAt: null,
  });
  if (!doc) return apiError(404, "Document not found");

  return NextResponse.json({ data: apiDocument(doc) });
}
