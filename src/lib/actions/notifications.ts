"use server";

import { revalidatePath } from "next/cache";
import { requireUser, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";

/** Mark one of the caller's notifications as read. */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    const user = await requireUser();
    const objectId = toObjectId(id);
    if (!objectId) return;
    await collections
      .notifications()
      .updateOne(
        { _id: objectId, userId: user.id },
        { $set: { readAt: new Date() } },
      );
    revalidatePath("/app", "layout");
  } catch {
    /* best-effort */
  }
}

/** Mark every unread notification of the caller as read. */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const user = await requireUser();
    await collections
      .notifications()
      .updateMany({ userId: user.id, readAt: null }, { $set: { readAt: new Date() } });
    revalidatePath("/app", "layout");
  } catch {
    /* best-effort */
  }
}
