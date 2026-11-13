import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { TEMPLATES, templateById } from "@/lib/templates/registry";
import { sampleContact, sampleDocument, sampleWorkspace } from "@/lib/templates/sample";
import { DocumentSwitcher } from "@/components/landing/document-switcher";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Letterpad — quotations, bills and business letters that look like you meant it",
  description:
    "Set up your letterhead once, pick a template, and download client-ready PDF quotations, invoices, payment requests and letters.",
};

const EYEBROW =
  "mb-4 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-royal";

const STEPS = [
  [
    "01",
    "Set your letterhead",
    "Logo, address, tax ID, bank details, brand colour — saved to your workspace and reused everywhere.",
  ],
  [
    "02",
    "Pick a template",
    "Ten letterhead layouts for quotations, bills, payment requests and formal letters. Switch later, keep your content.",
  ],
  [
    "03",
    "Download the PDF",
    "Live preview while you type, automatic numbering (QTN-, INV-, REQ-), totals that always add up.",
  ],
] as const;

export default function LandingPage() {
  const quote = sampleDocument(
    "quote",
    "quote-classic",
    templateById("quote-classic")?.layout ?? {
      headerStyle: "left",
      fontPair: "mixed",
      showLogo: true,
    },
  );
  const letter = sampleDocument(
    "letter",
    "letter-classic",
    templateById("letter-classic")?.layout ?? {
      headerStyle: "left",
      fontPair: "mixed",
      showSignature: true,
    },
  );

  return (
    <div className="min-h-dvh bg-paper">
      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-landing text-xl text-ink">
          Letter<span className="text-royal">pad</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm text-muted hover:text-ink">
            Sign in
          </Link>
          <Link href="/sign-up" className={buttonVariants("accent", "sm")}>
            Create your letterhead
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-8 sm:gap-12 sm:pb-20 sm:pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div>
          <p className="mb-5 text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-royal">
            Letterhead · Quotations · Bills · Letters
          </p>
          <h1 className="font-landing text-[3rem] leading-[1.02] tracking-[-0.02em] text-ink sm:text-[4.25rem]">
            Your business paperwork,{" "}
            <em className="italic text-royal">in your hand</em> — ready to send.
          </h1>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-[1.7] text-muted">
            Set up your letterhead once. After that, every document you write
            comes out as a clean, client-ready PDF — nothing to format,
            nothing to recheck.
          </p>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink/80">
            <li className="flex items-center gap-1.5">
              <Check className="size-4 shrink-0 text-royal" aria-hidden="true" />
              Automatic numbering (QTN-, INV-, REQ-)
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="size-4 shrink-0 text-royal" aria-hidden="true" />
              Totals that always add up
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="size-4 shrink-0 text-royal" aria-hidden="true" />
              Logo, address &amp; bank details, saved once
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/sign-up" className={buttonVariants("accent", "md")}>
              Create your letterhead
            </Link>
            <Link
              href="#how"
              className="text-sm text-ink underline underline-offset-4 hover:text-royal"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted">
            Email and password — no card, no setup call.
          </p>
        </div>

        <div>
          <div className="relative">
            <div className="sheet-shadow rotate-[-1.5deg] overflow-hidden rounded-[1px] bg-white transition-transform hover:rotate-0">
              <PdfPreview
                workspace={sampleWorkspace}
                doc={quote}
                contact={sampleContact}
                className="aspect-[1/1.4142] w-full"
              />
            </div>
            <div className="absolute -bottom-8 -left-3 w-28 overflow-hidden rounded-[1px] bg-white shadow-lg ring-1 ring-line rotate-[3deg] sm:-left-6 sm:w-40 md:-left-4 lg:-left-14 lg:w-48">
              <PdfPreview
                workspace={sampleWorkspace}
                doc={letter}
                className="aspect-[1/1.4142] w-full"
              />
            </div>
          </div>
          <p className="mt-12 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted">
            <span
              className="size-1.5 shrink-0 rounded-full bg-royal"
              aria-hidden="true"
            />
            <span>
              Live PDF —{" "}
              <span className="font-mono text-royal">QTN-0042</span>, rendered
              in your browser
            </span>
          </p>
        </div>
      </section>

      {/* live document switcher */}
      <section className="border-y border-line bg-white">
        <DocumentSwitcher />
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <h2 className="mb-10 max-w-xl font-landing text-3xl tracking-[-0.015em] text-ink sm:text-4xl">
          Three steps, then it&rsquo;s just writing.
        </h2>
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-10">
          {STEPS.map(([n, title, body]) => (
            <li key={n} className="border-t border-line pt-5">
              <p className="mb-3 font-mono text-sm text-royal">{n}</p>
              <h3 className="font-landing text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* templates */}
      <section className="border-y border-line bg-paper-dim">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:py-24 lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-14">
          <div>
            <p className={EYEBROW}>Templates</p>
            <h2 className="font-landing text-3xl tracking-[-0.015em] text-ink sm:text-4xl">
              Ten layouts, one letterhead.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
              Classic and modern headers, serif or sans. Switch any time —
              your content stays put.
            </p>
            <Link
              href="/sign-up"
              className={`mt-6 ${buttonVariants("accent", "md")}`}
            >
              Start with any layout
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <li
                key={t.id}
                className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium text-ink/80"
              >
                {t.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* closing CTA */}
      <section className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-landing text-2xl text-paper sm:text-3xl">
              The first document takes about four minutes.
            </h2>
            <p className="mt-1 text-sm text-paper/75">
              Start with your business name — the rest can wait until you need
              it.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/sign-up" className={buttonVariants("accent", "md")}>
              Create your letterhead
            </Link>
            <Link
              href="/sign-in"
              className="text-sm text-paper/85 underline underline-offset-4 hover:text-paper"
            >
              I already have an account →
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted">
        <p>
          Letter<span className="text-royal">pad</span> — business documents,
          properly papered.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="hover:text-ink">
            Sign in
          </Link>
          <p>{new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
