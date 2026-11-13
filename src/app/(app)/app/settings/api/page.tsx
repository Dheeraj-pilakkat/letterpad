import type { Metadata } from "next";
import { requireManager } from "@/lib/auth/session";
import { maskApiKey } from "@/lib/api-key";
import { currentPlanId, planDef } from "@/lib/plans";
import { ApiKeyControls } from "@/components/settings/api-key-controls";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Public API" };

const EXAMPLES: Array<{ label: string; code: string }> = [
  {
    label: "Workspace & plan",
    code: "curl -H \"Authorization: Bearer lpk_…\" https://your-letterpad.app/api/v1/me",
  },
  {
    label: "List documents",
    code: "curl -H \"Authorization: Bearer lpk_…\" \"https://your-letterpad.app/api/v1/documents?limit=20&status=sent\"",
  },
  {
    label: "Create a draft quotation",
    code: `curl -X POST -H "Authorization: Bearer lpk_…" -H "Content-Type: application/json" \\
  -d '{"type":"quote","templateId":"quote-classic","title":"Website redesign"}' \\
  https://your-letterpad.app/api/v1/documents`,
  },
  {
    label: "List contacts",
    code: "curl -H \"Authorization: Bearer lpk_…\" https://your-letterpad.app/api/v1/contacts",
  },
];

export default async function ApiSettingsPage() {
  const { workspace } = await requireManager();
  const plan = planDef(workspace);
  const planId = currentPlanId(workspace);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://your-letterpad.app";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="mb-2 font-display text-sm tracking-wide text-royal">
          INTEGRATIONS
        </p>
        <h1 className="font-display text-3xl text-ink">Public API</h1>
        <p className="mt-1 text-sm text-muted">
          Let scripts, Zapier-style tools and your own apps read and create
          documents with a Bearer key.
        </p>
      </header>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">API key</h2>
          <p className="mb-3 text-xs text-muted">
            Send it as <code className="font-mono">Authorization: Bearer lpk_…</code>{" "}
            on every request. Treat it like a password.
          </p>

          <div className="mb-4 rounded-[4px] border border-line bg-paper px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted">Current key</p>
            <p className="mt-1 break-all font-mono text-sm text-ink">
              {workspace.apiKey ? maskApiKey(workspace.apiKey) : "No key yet"}
            </p>
          </div>

          <ApiKeyControls hasKey={Boolean(workspace.apiKey)} />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">Rate limits</h2>
          <p className="text-xs text-muted">
            The <strong className="font-medium text-ink">{plan.name}</strong> plan (
            {planId}) allows{" "}
            <strong className="font-medium text-ink">{plan.apiRatePerMin} requests per minute</strong>,
            tracked in a fixed 60-second window. Exceeding it returns HTTP 429.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Endpoints</h2>
          <ul className="space-y-2 text-xs text-muted">
            <li>
              <code className="text-ink">GET {origin}/api/v1/me</code> — workspace,
              plan and usage
            </li>
            <li>
              <code className="text-ink">GET /api/v1/documents</code> — list
              (page, limit, type, status)
            </li>
            <li>
              <code className="text-ink">GET /api/v1/documents/:id</code> — one
              document
            </li>
            <li>
              <code className="text-ink">POST /api/v1/documents</code> — create a
              draft (plan quota applies)
            </li>
            <li>
              <code className="text-ink">GET /api/v1/contacts</code> — list
              contacts
            </li>
            <li>
              <code className="text-ink">POST /api/v1/contacts</code> — create a
              contact
            </li>
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-ink">Examples</h2>
          <div className="space-y-3">
            {EXAMPLES.map((ex) => (
              <div key={ex.label}>
                <p className="text-xs font-medium text-ink">{ex.label}</p>
                <pre className="mt-1 overflow-x-auto rounded-[4px] bg-paper p-3 text-[11px] leading-relaxed text-ink-soft">
                  {ex.code}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
