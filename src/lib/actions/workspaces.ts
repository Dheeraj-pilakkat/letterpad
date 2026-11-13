"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireUser, toObjectId, WORKSPACE_COOKIE } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { slugify } from "@/lib/utils";

export type ActionResult = { ok: boolean; error?: string; id?: string };

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

async function setWorkspaceCookie(id: string): Promise<void> {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Switch the active workspace (must own it or be a member). */
export async function switchWorkspaceAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid workspace id" };

    const ws = await collections.workspaces().findOne({
      _id: objectId,
      $or: [{ ownerUserId: user.id }, { "members.userId": user.id }],
    });
    if (!ws) return { ok: false, error: "Workspace not found" };

    await setWorkspaceCookie(objectId.toHexString());
    revalidatePath("/", "layout");
    return { ok: true, id: objectId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to switch workspace" };
  }
}

/**
 * Create an additional workspace owned by the current user and switch to it.
 * Business details start empty — the user can fill them in Settings → Business.
 */
export async function createWorkspaceAction(name: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Workspace name is required" };
    if (clean.length > 80) return { ok: false, error: "Name must be 80 characters or fewer" };

    const now = new Date();
    const slug = `${slugify(clean) || "business"}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    const result = await collections.workspaces().insertOne({
      _id: new ObjectId(),
      name: clean,
      slug,
      ownerUserId: user.id,
      currency: "USD",
      taxRate: 0,
      brandColor: "#B4552D",
      brandColors: ["#B4552D"],
      members: [],
      createdAt: now,
      updatedAt: now,
    });

    await setWorkspaceCookie(result.insertedId.toHexString());
    revalidatePath("/", "layout");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create workspace" };
  }
}
