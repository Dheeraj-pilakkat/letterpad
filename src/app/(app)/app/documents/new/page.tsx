import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import {
  DOCUMENT_TYPES,
  TYPE_META,
  templatesForType,
} from "@/lib/templates/registry";
import { sampleContact, sampleDocument, sampleWorkspace } from "@/lib/templates/sample";
import { createDocumentAction } from "@/lib/actions/documents";
import { PdfPreview } from "@/components/documents/pdf-preview";
import type { DocumentType } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "New document" };

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; template?: string }>;
}) {
  await requireWorkspace();
  const { type, template } = await searchParams;
  const activeType = DOCUMENT_TYPES.includes(type as DocumentType)
    ? (type as DocumentType)
    : null;

  if (!activeType) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="font-display text-3xl text-ink">What are you writing?</h1>
          <p className="mt-1 text-sm text-muted">
            Every document gets your letterhead, numbering and totals for free.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          {DOCUMENT_TYPES.map((t) => (
            <Link
              key={t}
              href={`/app/documents/new?type=${t}`}
              className="group rounded-[4px] border border-line bg-white p-5 transition-colors hover:border-copper"
            >
              <p className="font-display text-xl text-ink group-hover:text-copper">
                {TYPE_META[t].label}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {TYPE_META[t].blurb}
              </p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const templates = templatesForType(activeType);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <Link
          href="/app/documents/new"
          className="text-sm text-muted hover:text-ink"
        >
          ← All types
        </Link>
        <h1 className="mt-2 font-display text-3xl text-ink">
          {TYPE_META[activeType].label} templates
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick a letterhead style — you can switch templates later without losing
          your content.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => {
          const sample = sampleDocument(activeType, t.id, {
            ...t.layout,
            accentColor: sampleWorkspace.brandColor,
          });
          return (
            <div
              key={t.id}
              className={cn(
                "flex flex-col overflow-hidden rounded-[4px] border bg-white",
                template === t.id ? "border-copper ring-1 ring-copper/30" : "border-line",
              )}
            >
              <div className="border-b border-line bg-paper p-3">
                <div className="sheet-shadow mx-auto overflow-hidden rounded-[1px] bg-white">
                  <PdfPreview
                    workspace={sampleWorkspace}
                    doc={sample}
                    contact={sampleContact}
                    className="aspect-[1/1.4142] w-full"
                  />
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-medium text-ink">{t.name}</p>
                <p className="mb-4 mt-1 flex-1 text-xs leading-relaxed text-muted">
                  {t.description}
                </p>
                <form action={createDocumentAction}>
                  <input type="hidden" name="type" value={activeType} />
                  <input type="hidden" name="templateId" value={t.id} />
                  <button
                    type="submit"
                    className="h-9 w-full rounded-[3px] bg-ink text-sm font-medium text-paper hover:bg-ink-soft"
                  >
                    Use this template
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
