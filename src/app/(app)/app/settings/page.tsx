import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { SignOutButton } from "@/components/app/sign-out-button";
import { ProfileForm, ChangePasswordForm } from "@/components/settings/settings-forms";
import { RazorpayCard } from "@/components/settings/razorpay-card";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace, role } = await requireWorkspace();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Settings</h1>
      </header>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Profile</h2>
          <ProfileForm name={user.name} email={user.email} />
          <div className="mt-6 border-t border-line pt-4">
            <SignOutButton />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Password</h2>
          <ChangePasswordForm />
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Business</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Letterhead</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">
                {workspace.name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Default currency</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">
                {workspace.currency}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Workspace ID</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right font-mono text-xs text-muted">
                {workspace.slug}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Razorpay</h2>
          <RazorpayCard
            keyId={workspace.razorpayKeyId ?? null}
            hasSecret={Boolean(workspace.razorpayKeySecret)}
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">Subscription &amp; Billing</h2>
              <p className="mt-1 text-xs text-muted">
                Plan, limits, premium templates and white-label branding
              </p>
            </div>
            <Link
              href="/app/settings/billing"
              className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
            >
              Open billing →
            </Link>
          </div>
        </Card>

        {role !== "member" ? (
          <>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-ink">Public API</h2>
                  <p className="mt-1 text-xs text-muted">
                    Bearer keys for scripts and third-party integrations
                  </p>
                </div>
                <Link
                  href="/app/settings/api"
                  className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
                >
                  Open API →
                </Link>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-ink">Integrations</h2>
                  <p className="mt-1 text-xs text-muted">
                    Razorpay, email, AI, WhatsApp and outbound webhooks
                  </p>
                </div>
                <Link
                  href="/app/settings/integrations"
                  className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
                >
                  Open integrations →
                </Link>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-ink">Team</h2>
                  <p className="mt-1 text-xs text-muted">
                    {workspace.members?.length ?? 0} member
                    {(workspace.members?.length ?? 0) === 1 ? "" : "s"} · invite
                    people and manage roles
                  </p>
                </div>
                <Link
                  href="/app/settings/team"
                  className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
                >
                  Manage team →
                </Link>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
