import "server-only";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth/config";
import { collections } from "@/lib/db/client";
import type { Workspace, WorkspaceRole } from "@/lib/db/types";

/** Cookie holding the active workspace id (set on switch/create). */
export const WORKSPACE_COOKIE = "lp_ws";

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

export type SessionUser = { id: string; name: string; email: string };

function roleFor(workspace: Workspace, userId: string): WorkspaceRole {
  if (workspace.ownerUserId === userId) return "owner";
  const member = workspace.members?.find((m) => m.userId === userId);
  return member?.role ?? "member";
}

/**
 * Resolve the active workspace: the `lp_ws` cookie when it points at a
 * workspace the user owns or belongs to, otherwise the oldest owned
 * workspace, otherwise the oldest membership. Returns null when the user
 * has no workspace at all (→ onboarding).
 */
export async function resolveWorkspace(
  user: { id: string },
): Promise<{ workspace: Workspace; role: WorkspaceRole } | null> {
  const store = await cookies();
  const wanted = store.get(WORKSPACE_COOKIE)?.value;

  if (wanted && ObjectId.isValid(wanted)) {
    const oid = new ObjectId(wanted);
    const ws = await collections.workspaces().findOne({
      _id: oid,
      $or: [{ ownerUserId: user.id }, { "members.userId": user.id }],
    });
    if (ws) return { workspace: ws, role: roleFor(ws, user.id) };
  }

  const owned = await collections
    .workspaces()
    .findOne({ ownerUserId: user.id }, { sort: { createdAt: 1 } });
  if (owned) return { workspace: owned, role: "owner" };

  const member = await collections
    .workspaces()
    .findOne({ "members.userId": user.id }, { sort: { createdAt: 1 } });
  if (member) return { workspace: member, role: roleFor(member, user.id) };

  return null;
}

/** The active workspace plus the caller's role in it. */
export async function requireWorkspace(): Promise<{
  user: SessionUser;
  workspace: Workspace;
  role: WorkspaceRole;
}> {
  const user = await requireUser();
  const resolved = await resolveWorkspace(user);
  if (!resolved) {
    redirect("/onboarding");
  }
  return {
    user: { id: user.id, name: user.name, email: user.email },
    workspace: resolved.workspace,
    role: resolved.role,
  };
}

/** Manager gate (owner/admin) for pages — members are sent back to the app. */
export async function requireManager() {
  const ctx = await requireWorkspace();
  if (ctx.role === "member") {
    redirect("/app");
  }
  return ctx;
}

/** All workspaces the user can see, with their role in each. */
export async function listWorkspacesFor(
  user: { id: string },
): Promise<Array<{ id: string; name: string; role: WorkspaceRole }>> {
  const [owned, memberOf] = await Promise.all([
    collections
      .workspaces()
      .find({ ownerUserId: user.id })
      .sort({ createdAt: 1 })
      .toArray(),
    collections
      .workspaces()
      .find({ "members.userId": user.id })
      .sort({ createdAt: 1 })
      .toArray(),
  ]);
  const byId = new Map<string, { id: string; name: string; role: WorkspaceRole }>();
  for (const ws of owned) {
    byId.set(ws._id.toHexString(), {
      id: ws._id.toHexString(),
      name: ws.name,
      role: "owner",
    });
  }
  for (const ws of memberOf) {
    const id = ws._id.toHexString();
    if (!byId.has(id)) {
      byId.set(id, { id, name: ws.name, role: roleFor(ws, user.id) });
    }
  }
  return [...byId.values()];
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
