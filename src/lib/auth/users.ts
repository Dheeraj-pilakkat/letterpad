import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/client";

/**
 * Best-effort lookup of a better-auth user record (id → name/email).
 * better-auth's MongoDB adapter may store the id as `_id` (ObjectId or
 * string) or as a separate `id` field depending on version — try all.
 */
export async function lookupUser(
  userId: string,
): Promise<{ name?: string; email?: string } | null> {
  try {
    const col = getDb().collection<{ id?: string; name?: string; email?: string }>(
      "user",
    );
    const byId = await col.findOne({ id: userId });
    if (byId) return byId;
    if (ObjectId.isValid(userId)) {
      const byObjectId = await col.findOne({ _id: new ObjectId(userId) });
      if (byObjectId) return byObjectId;
    }
    const byStringId = await col.findOne({ _id: userId as never });
    return byStringId;
  } catch {
    return null;
  }
}
