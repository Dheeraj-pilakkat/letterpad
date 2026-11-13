import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import type { ActivityType } from "@/lib/db/types";

/** Append a document activity event. Never throws into the caller's happy path. */
export async function logActivity(input: {
  workspaceId: ObjectId;
  documentId: ObjectId;
  type: ActivityType;
  message: string;
  actor: string;
}): Promise<void> {
  try {
    await collections.activity().insertOne({
      _id: new ObjectId(),
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      type: input.type,
      message: input.message,
      actor: input.actor,
      createdAt: new Date(),
    });
  } catch {
    // Activity is best-effort — do not fail the primary action.
  }
}

export async function listDocumentActivity(
  workspaceId: ObjectId,
  documentId: ObjectId,
  limit = 50,
) {
  return collections
    .activity()
    .find({ workspaceId, documentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
