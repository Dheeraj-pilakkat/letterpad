import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { SignOutButton } from "@/components/app/sign-out-button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, workspace } = await requireWorkspace();

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Settings</h1>
      </header>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Account</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Name</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Email</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">{user.email}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <SignOutButton />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Business</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Letterhead</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">{workspace.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Default currency</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right text-ink">{workspace.currency}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="shrink-0 text-muted">Workspace ID</dt>
              <dd className="min-w-0 max-w-[70%] truncate text-right font-mono text-xs text-muted">
                {workspace.slug}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
