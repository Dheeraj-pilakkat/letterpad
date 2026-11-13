import type { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";

/** Documents created in the current calendar month (workspace quota, §20). */
export async function countDocumentsThisMonth(workspaceId: ObjectId): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return collections
    .documents()
    .countDocuments({ workspaceId, createdAt: { $gte: monthStart } });
}
