import type { Metadata } from "next";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { requireManager } from "@/lib/auth/session";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { aiConfigured } from "@/lib/ai";
import { hasPlanFeature } from "@/lib/plans";
import { WebhookForm } from "@/components/settings/webhook-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Integrations" };

function StatusRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span
        className={
          ok
            ? "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-forest/15 text-forest"
            : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-paper-dim text-muted"
        }
        aria-hidden
      >
        {ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{detail}</p>
      </div>
      <span
        className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
          ok ? "bg-forest/10 text-forest" : "bg-paper-dim text-muted"
        }`}
      >
        {ok ? "On" : "Off"}
      </span>
    </div>
  );
}

export default async function IntegrationsPage() {
  const { workspace } = await requireManager();

  const razorpayOk = isRazorpayConfigured(workspace);
  const emailOk = Boolean(process.env.RESEND_API_KEY);
  const aiOk = aiConfigured();
  const webhooksOk = hasPlanFeature(workspace, "webhooks");
  const webhook = workspace.webhook;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="mb-2 font-display text-sm tracking-wide text-royal">
          INTEGRATIONS
        </p>
        <h1 className="font-display text-3xl text-ink">Integrations</h1>
        <p className="mt-1 text-sm text-muted">
          Payment, email, AI and webhook connections for this workspace.
        </p>
      </header>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">Razorpay payments</h2>
          <p className="mb-2 text-xs text-muted">
            Collect invoice and quote payments through Razorpay Checkout.{" "}
            <Link href="/app/settings" className="text-royal hover:underline">
              Configure keys in Settings →
            </Link>
          </p>
          <StatusRow
            ok={razorpayOk}
            label={razorpayOk ? "Checkout ready" : "Not configured"}
            detail={
              razorpayOk
                ? "Pay buttons appear on shared invoices and quotes."
                : "Add a key id and secret under Settings → Razorpay."
            }
          />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">Email delivery</h2>
          <StatusRow
            ok={emailOk}
            label={emailOk ? "Resend connected" : "Resend not configured"}
            detail={
              emailOk
                ? "Documents, portal invites and reminders are emailed."
                : "Set RESEND_API_KEY on the server to enable sending."
            }
          />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">AI writing assistant</h2>
          <StatusRow
            ok={aiOk && hasPlanFeature(workspace, "ai")}
            label={
              !aiOk
                ? "AI key not configured"
                : hasPlanFeature(workspace, "ai")
                  ? "AI assistant ready"
                  : "Needs the Professional plan"
            }
            detail={
              !aiOk
                ? "Set AI_API_KEY on the server; the editor's AI tools unlock automatically."
                : hasPlanFeature(workspace, "ai")
                  ? "Generate and improve text from the document editor."
                  : "Upgrade to Professional to unlock AI in the editor."
            }
          />
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-medium text-ink">WhatsApp</h2>
          <StatusRow
            ok
            label="Click-to-chat links"
            detail="Share documents as WhatsApp links from any contact — no key required."
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-ink">Outbound webhooks</h2>
              <p className="mt-1 text-xs text-muted">
                POST signed JSON events when documents are created or change
                status. Events:{" "}
                <code className="font-mono">document.created</code>,{" "}
                <code className="font-mono">document.status_changed</code>.
              </p>
            </div>
          </div>
          <WebhookForm
            url={webhook?.url ?? ""}
            enabled={webhook?.enabled === true}
            secret={webhook?.secret ?? null}
            canUse={webhooksOk}
          />
        </Card>
      </div>
    </div>
  );
}
