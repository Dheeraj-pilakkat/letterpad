import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/session";
import {
  TEMPLATES,
  TYPE_META,
  type TemplateDef,
} from "@/lib/templates/registry";
import { hasPlanFeature } from "@/lib/plans";
import { sampleContact, sampleDocument, sampleWorkspace } from "@/lib/templates/sample";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { TypeBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Templates" };

function TemplateCard({
  template,
  accent,
  locked,
}: {
  template: TemplateDef;
  accent: string;
  locked: boolean;
}) {
  const sample = sampleDocument(template.type, template.id, {
    ...template.layout,
    accentColor: accent,
  });
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-white">
      <div className="border-b border-line bg-paper p-3">
        <div className="sheet-shadow mx-auto overflow-hidden rounded-[1px] bg-white">
          <PdfPreview
            workspace={{ ...sampleWorkspace, brandColor: accent }}
            doc={sample}
            contact={sampleContact}
            className="aspect-[1/1.4142] w-full"
          />
        </div>
      </div>
      <div className="p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="font-medium text-ink">{template.name}</p>
          {template.premium ? (
            <span
              className={
                locked
                  ? "flex items-center gap-1 rounded-full bg-paper-dim px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                  : "rounded-full bg-royal/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-royal"
              }
            >
              {locked ? <Lock size={10} /> : null} Premium
            </span>
          ) : (
            <TypeBadge type={template.type} />
          )}
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          {template.description}
        </p>
        {locked ? (
          <Link
            href="/app/settings/billing"
            className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line bg-white px-3 text-xs font-medium text-ink hover:border-royal hover:text-royal"
          >
            <Lock size={12} /> Unlock with Starter
          </Link>
        ) : (
          <Link
            href={`/app/documents/new?type=${template.type}&template=${template.id}`}
            className="inline-flex h-8 items-center rounded-[3px] border border-line bg-white px-3 text-xs font-medium text-ink hover:border-royal hover:text-royal"
          >
            Use template →
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function TemplatesPage() {
  const { workspace } = await requireWorkspace();
  const premiumOk = hasPlanFeature(workspace, "premiumTemplates");

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl text-ink">Template gallery</h1>
        <p className="mt-1 text-sm text-muted">
          {TEMPLATES.length} letterhead styles, rendered here with your brand colour ({workspace.brandColor}). Switch
          templates any time — content is preserved.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            accent={workspace.brandColor}
            locked={Boolean(t.premium && !premiumOk)}
          />
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        Looking for a different layout?{" "}
        <Link href="/app/company" className="text-royal underline underline-offset-2">
          Update your letterhead details
        </Link>{" "}
        — logo, colours and bank details flow into every template automatically.{" "}
        <span className="text-muted/70">
          ({TYPE_META.request.label} templates cover both payment requests and formal letters.)
        </span>
      </p>
    </div>
  );
}
