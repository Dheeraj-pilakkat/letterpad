import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { canAcceptInvite, effectiveInviteStatus } from "@/lib/team";
import { AcceptInviteButton } from "@/components/settings/accept-invite-button";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getSession();
  const user = session?.user;

  const invite = token ? await collections.invites().findOne({ token }) : null;
  const workspace = invite
    ? await collections.workspaces().findOne({ _id: invite.workspaceId })
    : null;

  if (!invite || !workspace) {
    return (
      <InviteShell>
        <h1 className="font-display text-2xl text-ink">Invitation not found</h1>
        <p className="mt-2 text-sm text-muted">
          This link is invalid or has been revoked. Ask the workspace owner to
          send a new invitation.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-royal hover:underline">
          Back to Letterpad
        </Link>
      </InviteShell>
    );
  }

  const status = effectiveInviteStatus(invite);
  const gate = canAcceptInvite(invite, user?.email);

  return (
    <InviteShell>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-royal">
        Workspace invitation
      </p>
      <h1 className="font-display text-2xl text-ink">
        Join {workspace.name}
      </h1>
      <p className="mt-2 text-sm text-muted">
        <strong>{invite.invitedByName}</strong> invited{" "}
        <strong>{invite.email}</strong> to join as{" "}
        <strong>{invite.role === "admin" ? "an admin" : "a member"}</strong>.
      </p>

      {!user ? (
        <div className="mt-5 rounded-[4px] border border-line bg-paper p-4 text-sm text-ink">
          <p>Sign in (or create an account) with this email address to accept.</p>
          <Link
            href="/sign-in"
            className="mt-3 inline-flex h-10 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
          >
            Sign in
          </Link>
        </div>
      ) : !gate.ok ? (
        <div className="mt-5 rounded-[4px] border border-line bg-paper p-4 text-sm text-ink" role="alert">
          {gate.error}
          {status === "pending" ? (
            <Link href="/sign-in" className="mt-2 block text-sm text-royal hover:underline">
              Sign out &amp; switch account
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 rounded-[4px] border border-line bg-paper p-4">
          <p className="text-sm text-ink">
            You&apos;re signed in as <strong>{user.email}</strong>. Accepting will add
            you to this workspace and switch your active workspace to it.
          </p>
          <div className="mt-3">
            <AcceptInviteButton token={token} />
          </div>
        </div>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md rounded-[4px] border border-line bg-white p-6 shadow-[0_1px_2px_rgba(28,37,54,0.05)]">
        {children}
      </div>
    </main>
  );
}
