import type { InviteStatus, WorkspaceRole } from "@/lib/db/types";

/* ============================================================
   Pure team helpers — invites, roles, email rules.
   ============================================================ */

/** Lowercase + trim for reliable email comparisons. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

/** Roles allowed on an invite / member row (owner is never assigned). */
export type AssignableRole = Exclude<WorkspaceRole, "owner">;

export function isAssignableRole(value: string): value is AssignableRole {
  return value === "admin" || value === "member";
}

/** Owners and admins may manage the team; plain members may not. */
export function canManage(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Resolve an invite's effective status — a pending invite past its expiry
 * reads as "expired".
 */
export function effectiveInviteStatus(
  invite: { status: InviteStatus; expiresAt: string },
  now: Date = new Date(),
): InviteStatus {
  if (invite.status !== "pending") return invite.status;
  return now.toISOString() > invite.expiresAt ? "expired" : "pending";
}

/** Can this session accept this invite? */
export function canAcceptInvite(
  invite: { status: InviteStatus; expiresAt: string; email: string },
  sessionEmail: string | undefined,
  now: Date = new Date(),
): { ok: true } | { ok: false; error: string } {
  if (!sessionEmail) return { ok: false, error: "Sign in first" };
  if (normalizeEmail(invite.email) !== normalizeEmail(sessionEmail)) {
    return {
      ok: false,
      error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
    };
  }
  const status = effectiveInviteStatus(invite, now);
  if (status === "accepted") return { ok: false, error: "This invitation was already accepted." };
  if (status === "revoked") return { ok: false, error: "This invitation was revoked." };
  if (status === "expired") return { ok: false, error: "This invitation has expired. Ask for a new one." };
  return { ok: true };
}

/** Invite links live at /invite/<token>. */
export function invitePath(token: string): string {
  return `/invite/${token}`;
}

/** Plain-text invite email body. */
export function inviteEmailText(input: {
  inviterName: string;
  workspaceName: string;
  role: AssignableRole;
  url: string;
}): string {
  const roleLabel = input.role === "admin" ? "admin" : "member";
  return [
    `${input.inviterName} invited you to join "${input.workspaceName}" on Letterpad as ${roleLabel}.`,
    "",
    `Accept the invitation: ${input.url}`,
    "",
    "If you don't have an account yet, sign up with this email address first, then open the link.",
  ].join("\n");
}
