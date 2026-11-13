import "server-only";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import type { BusinessProfile, LetterpadDoc } from "@/lib/db/types";

/** Cookie holding the active business-profile id (§6); absent = workspace default. */
export const PROFILE_COOKIE = "lp_profile";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** All profiles of a workspace, oldest first (stable switcher order). */
export async function listProfiles(
  workspaceId: ObjectId,
): Promise<BusinessProfile[]> {
  return collections
    .businessProfiles()
    .find({ workspaceId })
    .sort({ createdAt: 1 })
    .toArray();
}

/**
 * The active profile for a workspace: reads the `lp_profile` cookie and
 * validates it belongs to this workspace — otherwise falls back to null
 * (workspace default branding). Never returns another workspace's profile.
 */
export async function getActiveProfile(
  workspaceId: ObjectId,
): Promise<BusinessProfile | null> {
  const store = await cookies();
  const raw = store.get(PROFILE_COOKIE)?.value;
  if (!raw || !ObjectId.isValid(raw)) return null;
  return collections
    .businessProfiles()
    .findOne({ _id: new ObjectId(raw), workspaceId });
}

/** Set (or clear, with null) the active-profile cookie. */
export async function setActiveProfileCookie(
  id: string | null,
): Promise<void> {
  const store = await cookies();
  if (!id) {
    store.delete(PROFILE_COOKIE);
    return;
  }
  store.set(PROFILE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Raw active-profile cookie value (validated by `getActiveProfile`). */
export async function getActiveProfileCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(PROFILE_COOKIE)?.value ?? null;
}

/** Load the profile a document was issued under (null = workspace default). */
export async function loadProfileForDoc(
  doc: Pick<LetterpadDoc, "profileId" | "workspaceId">,
): Promise<BusinessProfile | null> {
  if (!doc.profileId) return null;
  return collections
    .businessProfiles()
    .findOne({ _id: doc.profileId, workspaceId: doc.workspaceId });
}
