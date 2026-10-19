import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth/config";
import { collections } from "@/lib/db/client";
import type { Workspace } from "@/lib/db/types";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session.user;
}

/** The signed-in user's single workspace (MVP: one per account). */
export async function requireWorkspace(): Promise<{
  user: { id: string; name: string; email: string };
  workspace: Workspace;
}> {
  const user = await requireUser();
  const workspace = await collections
    .workspaces()
    .findOne({ ownerUserId: user.id });
  if (!workspace) {
    redirect("/onboarding");
  }
  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace,
  };
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
