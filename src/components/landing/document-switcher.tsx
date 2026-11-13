"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { sampleContact, sampleDocument, sampleWorkspace } from "@/lib/templates/sample";
import { TYPE_META, templateById } from "@/lib/templates/registry";
import { cn, NUMBER_PREFIX } from "@/lib/utils";

const MAKES = ["quote", "invoice", "request", "letter"] as const;
type Make = (typeof MAKES)[number];

const TEMPLATE_FOR: Record<Make, string> = {
  quote: "quote-classic",
  invoice: "invoice-classic",
  request: "request-payment",
  letter: "letter-classic",
};

/**
 * Landing-page document switcher: pick a document type and watch the real
 * PDF render. Client-only — sample data is imported directly, so nothing
 * crosses the RSC boundary.
 */
export function DocumentSwitcher() {
  const [active, setActive] = useState<Make>("quote");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % MAKES.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + MAKES.length) % MAKES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = MAKES.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActive(MAKES[next]);
    tabRefs.current[next]?.focus();
  };

  const templateId = TEMPLATE_FOR[active];
  const layout =
    templateById(templateId)?.layout ?? {
      headerStyle: "left" as const,
      fontPair: "mixed" as const,
      showLogo: true,
    };
  const doc = {
    ...sampleDocument(active, templateId, layout),
    number: `${NUMBER_PREFIX[active]}-0042`,
  };
  const meta = TYPE_META[active];

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-royal">
        What it makes
      </p>
      <h2 className="max-w-xl font-landing text-3xl tracking-[-0.015em] text-ink sm:text-4xl">
        One letterhead, four kinds of paperwork.
      </h2>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
        Pick a type below — you&rsquo;re looking at the real PDF, rendered in
        your browser, numbering and totals included.
      </p>

      <div
        role="tablist"
        aria-label="Document types"
        className="-mx-6 mt-8 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:px-0"
      >
        {MAKES.map((type, index) => (
          <button
            key={type}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${type}`}
            aria-selected={active === type}
            aria-controls="document-panel"
            tabIndex={active === type ? 0 : -1}
            onClick={() => setActive(type)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "shrink-0 rounded-[3px] border px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-royal",
              active === type
                ? "border-royal bg-royal/5 text-royal"
                : "border-line bg-white text-muted hover:border-ink/30 hover:text-ink",
            )}
          >
            {TYPE_META[type].label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="document-panel"
        aria-labelledby={`tab-${active}`}
        className="mt-8 grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12"
      >
        <div>
          <p className="font-mono text-xs text-royal">{doc.number}</p>
          <h3 className="mt-2 font-landing text-2xl text-ink">{meta.label}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">{meta.blurb}</p>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            Your logo, address, tax ID and bank details sit on every one of
            these — set once, reused everywhere.
          </p>
        </div>
        <div className="sheet-shadow overflow-hidden rounded-[1px] bg-white ring-1 ring-line">
          <PdfPreview
            key={active}
            workspace={sampleWorkspace}
            doc={doc}
            contact={sampleContact}
            className="aspect-[1/1.4142] w-full"
          />
        </div>
      </div>
    </div>
  );
}
