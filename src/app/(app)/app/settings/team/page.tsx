import type { Metadata } from "next";
import { requireManager } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { lookupUser } from "@/lib/auth/users";
import { TeamPanel } from "@/components/settings/team-panel";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const { workspace, user, role } = await requireManager();

  const [invites, ownerRecord] = await Promise.all([
    collections
      .invites()
      .find({ workspaceId: workspace._id, status: "pending" })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    workspace.ownerUserId === user.id
      ? Promise.resolve({ name: user.name, email: user.email })
      : lookupUser(workspace.ownerUserId),
  ]);

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Team</h1>
        <p className="mt-1 text-sm text-muted">
          Invite people to work in <strong>{workspace.name}</strong>. Admins can
          manage documents and settings; members can work on documents.
        </p>
      </header>

      <TeamPanel
        currentUserId={user.id}
        isOwner={role === "owner"}
        owner={{
          userId: workspace.ownerUserId,
          name: ownerRecord?.name || "Workspace owner",
          email: ownerRecord?.email ?? "",
        }}
        members={(workspace.members ?? []).map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          addedAt: m.addedAt.toISOString(),
        }))}
        invites={invites.map((i) => ({
          id: i._id.toHexString(),
          token: i.token,
          email: i.email,
          role: i.role,
          expiresAt: i.expiresAt,
          status: i.status,
        }))}
      />
    </div>
  );
}
