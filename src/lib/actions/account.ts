"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { verifyPassword } from "better-auth/crypto";
import { auth } from "@/lib/auth/config";
import { toObjectId, WORKSPACE_COOKIE } from "@/lib/auth/session";
import { collections, getDb } from "@/lib/db/client";

export type DeleteAccountResult = { ok: boolean; error?: string };

type CredentialAccount = {
  userId: ObjectId;
  providerId: string;
  password?: string;
};

/** Remove every workspace-scoped record for one workspace. */
async function purgeWorkspaceData(wsId: ObjectId): Promise<void> {
  const byWorkspace = { workspaceId: wsId };
  await Promise.all([
    collections.contacts().deleteMany(byWorkspace),
    collections.documents().deleteMany(byWorkspace),
    collections.payments().deleteMany(byWorkspace),
    collections.expenses().deleteMany(byWorkspace),
    collections.products().deleteMany(byWorkspace),
    collections.projects().deleteMany(byWorkspace),
    collections.schedules().deleteMany(byWorkspace),
    collections.deliveries().deleteMany(byWorkspace),
    collections.activity().deleteMany(byWorkspace),
    collections.invites().deleteMany(byWorkspace),
    // Counter keys are `${workspaceIdHex}:${type}` — hex has no regex metachars.
    collections
      .counters()
      .deleteMany({ _id: { $regex: `^${wsId.toHexString()}:` } }),
    collections.workspaces().deleteOne({ _id: wsId }),
  ]);
}

/**
 * Permanently delete the signed-in user's account (§22 — account deletion):
 * verify password → purge owned workspaces + memberships + invites →
 * delete better-auth user/session/account rows → clear the workspace cookie.
 */
export async function deleteAccountAction(
  password: string,
): Promise<DeleteAccountResult> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return { ok: false, error: "You are signed out" };
    }
    const user = session.user;
    if (!password) {
      return { ok: false, error: "Enter your password to confirm" };
    }
    // better-auth stores auth _id/userId as ObjectIds; `user.id` is the hex form.
    const uid = toObjectId(user.id);
    if (!uid) {
      return { ok: false, error: "Invalid session" };
    }

    const account = await getDb()
      .collection<CredentialAccount>("account")
      .findOne({ userId: uid, providerId: "credential" });
    if (!account?.password) {
      return { ok: false, error: "Password verification failed" };
    }
    const valid = await verifyPassword({ hash: account.password, password });
    if (!valid) {
      return { ok: false, error: "Incorrect password" };
    }

    // 1. Owned workspaces — full cascade delete.
    const owned = await collections
      .workspaces()
      .find({ ownerUserId: user.id }, { projection: { _id: 1 } })
      .toArray();
    for (const ws of owned) {
      await purgeWorkspaceData(ws._id);
    }

    // 2. Memberships in other people's workspaces.
    await collections.workspaces().updateMany(
      { ownerUserId: { $ne: user.id }, "members.userId": user.id },
      { $pull: { members: { userId: user.id } } },
    );

    // 3. Pending invites addressed to this account.
    await collections.invites().deleteMany({ email: user.email });

    // 4. Auth records.
    const db = getDb();
    await Promise.all([
      db.collection<{ userId: ObjectId }>("session").deleteMany({ userId: uid }),
      db.collection<{ userId: ObjectId }>("account").deleteMany({ userId: uid }),
      db.collection<{ _id: ObjectId }>("user").deleteOne({ _id: uid }),
    ]);

    // 5. Drop the active-workspace cookie so the next load lands on sign-up.
    const store = await cookies();
    store.delete(WORKSPACE_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not delete account",
    };
  }
}
