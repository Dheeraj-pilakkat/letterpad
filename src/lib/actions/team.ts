"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import {
  requireUser,
  requireWorkspace,
  toObjectId,
  WORKSPACE_COOKIE,
} from "@/lib/auth/session";
import { collections, getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/share";
import { checkSeatLimit } from "@/lib/plans";
import { notifyWorkspace } from "@/lib/notify";
import {
  canAcceptInvite,
  canManage,
  inviteEmailText,
  invitePath,
  isAssignableRole,
  isValidEmail,
  normalizeEmail,
} from "@/lib/team";

export type ActionResult = { ok: boolean; error?: string; id?: string; token?: string; emailed?: boolean };

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function managerError(role: string): string | null {
  if (!canManage(role as "owner" | "admin" | "member")) {
    return "Only owners and admins can manage the team";
  }
  return null;
}

/** Invite someone (email + role) to the active workspace. */
export async function inviteMemberAction(
  email: string,
  role: string,
): Promise<ActionResult> {
  try {
    const { workspace, user, role: myRole } = await requireWorkspace();
    const denied = managerError(myRole);
    if (denied) return { ok: false, error: denied };

    if (!isAssignableRole(role)) {
      return { ok: false, error: "Role must be admin or member" };
    }
    const seats = checkSeatLimit(workspace, workspace.members?.length ?? 0);
    if (!seats.ok) return { ok: false, error: seats.error ?? "Seat limit reached" };
    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      return { ok: false, error: "Enter a valid email address" };
    }
    if (cleanEmail === normalizeEmail(user.email)) {
      return { ok: false, error: "You're already in this workspace" };
    }

    const existingMember = workspace.members?.some(
      (m) => normalizeEmail(m.email) === cleanEmail,
    );
    if (existingMember) {
      return { ok: false, error: "That person is already a member" };
    }

    const alreadyInvited = await collections
      .invites()
      .findOne({
        workspaceId: workspace._id,
        email: cleanEmail,
        status: "pending",
        expiresAt: { $gt: new Date().toISOString() },
      });
    if (alreadyInvited) {
      return { ok: false, error: "A pending invitation already exists for that email" };
    }

    const token = randomBytes(24).toString("hex");
    const now = new Date();
    const result = await collections.invites().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      email: cleanEmail,
      role,
      token,
      invitedBy: user.id,
      invitedByName: user.name,
      status: "pending",
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
      createdAt: now,
    });

    // §11.3 — notify the invitee in-app when they already have an account.
    try {
      const invitee = await getDb()
        .collection<{ _id: ObjectId }>("user")
        .findOne({ email: cleanEmail });
      if (invitee) {
        await notifyWorkspace({
          workspaceId: workspace._id,
          type: "team_invite",
          title: `${user.name} invited you to ${workspace.name}`,
          body: `Role: ${role} — open the invitation to accept`,
          href: invitePath(token),
          userIds: [invitee._id.toHexString()],
        });
      }
    } catch {
      /* best-effort */
    }

    // Best-effort email — only actually delivered when Resend is configured.
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    const url = origin ? `${origin}${invitePath(token)}` : invitePath(token);
    const mail = await sendEmail({
      to: cleanEmail,
      subject: `Join ${workspace.name} on Letterpad`,
      text: inviteEmailText({
        inviterName: user.name,
        workspaceName: workspace.name,
        role,
        url,
      }),
    });

    revalidatePath("/app/settings/team");
    return {
      ok: true,
      id: result.insertedId.toHexString(),
      token,
      emailed: mail.mode === "resend",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send invitation" };
  }
}

/** Revoke a pending invitation. */
export async function revokeInviteAction(id: string): Promise<ActionResult> {
  try {
    const { workspace, role: myRole } = await requireWorkspace();
    const denied = managerError(myRole);
    if (denied) return { ok: false, error: denied };

    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid invitation id" };
    const result = await collections.invites().updateOne(
      { _id: objectId, workspaceId: workspace._id, status: "pending" },
      { $set: { status: "revoked" } },
    );
    if (result.matchedCount === 0) {
      return { ok: false, error: "Invitation not found" };
    }
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revoke invitation" };
  }
}

/** Remove a member from the workspace. */
export async function removeMemberAction(memberUserId: string): Promise<ActionResult> {
  try {
    const { workspace, user, role: myRole } = await requireWorkspace();
    const denied = managerError(myRole);
    if (denied) return { ok: false, error: denied };

    if (memberUserId === workspace.ownerUserId) {
      return { ok: false, error: "The owner cannot be removed" };
    }
    if (memberUserId === user.id) {
      return { ok: false, error: "You cannot remove yourself" };
    }

    const result = await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $pull: { members: { userId: memberUserId } } },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Workspace not found" };
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to remove member" };
  }
}

/** Change a member's role (admin / member). */
export async function updateMemberRoleAction(
  memberUserId: string,
  role: string,
): Promise<ActionResult> {
  try {
    const { workspace, role: myRole } = await requireWorkspace();
    const denied = managerError(myRole);
    if (denied) return { ok: false, error: denied };
    if (!isAssignableRole(role)) return { ok: false, error: "Role must be admin or member" };

    const result = await collections.workspaces().updateOne(
      { _id: workspace._id, "members.userId": memberUserId },
      { $set: { "members.$.role": role, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Member not found" };
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update role" };
  }
}

/**
 * Accept an invitation: the signed-in user's email must match, then the
 * workspace becomes active (cookie) for them.
 */
export async function acceptInviteAction(token: string): Promise<ActionResult> {
  try {
    if (!token) return { ok: false, error: "Missing invitation token" };
    const user = await requireUser();

    const invite = await collections.invites().findOne({ token });
    if (!invite) return { ok: false, error: "Invitation not found" };

    const gate = canAcceptInvite(invite, user.email);
    if (!gate.ok) return { ok: false, error: gate.error };

    const workspace = await collections.workspaces().findOne({ _id: invite.workspaceId });
    if (!workspace) return { ok: false, error: "That workspace no longer exists" };

    const already = workspace.members?.some((m) => m.userId === user.id);
    if (!already) {
      await collections.workspaces().updateOne(
        { _id: workspace._id },
        {
          $push: {
            members: {
              userId: user.id,
              name: user.name,
              email: normalizeEmail(user.email),
              role: invite.role,
              addedAt: new Date(),
            },
          },
          $set: { updatedAt: new Date() },
        },
      );
    }

    await collections
      .invites()
      .updateOne(
        { _id: invite._id, status: "pending" },
        { $set: { status: "accepted", acceptedAt: new Date() } },
      );

    const store = await cookies();
    store.set(WORKSPACE_COOKIE, workspace._id.toHexString(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    revalidatePath("/", "layout");
    return { ok: true, id: workspace._id.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to accept invitation" };
  }
}
