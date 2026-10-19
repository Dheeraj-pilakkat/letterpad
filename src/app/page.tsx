import type { Metadata } from "next";
import Link from "next/link";
import { templateById, TYPE_META } from "@/lib/templates/registry";
import { sampleContact, sampleDocument, sampleWorkspace } from "@/lib/templates/sample";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Letterpad — quotations, bills and business letters that look like you meant it",
  description:
    "Set up your letterhead once, pick a template, and download client-ready PDF quotations, invoices, payment requests and letters.",
};

const MAKES = ["quote", "invoice", "request", "letter"] as const;

const ACRONYM: Record<(typeof MAKES)[number], string> = {
  quote: "QTN",
  invoice: "INV",
  request: "REQ",
  letter: "LTR",
};

export default function LandingPage() {
  const quote = sampleDocument(
    "quote",
    "quote-classic",
    templateById("quote-classic")?.layout ?? { headerStyle: "left", fontPair: "mixed", showLogo: true },
  );
  const letter = sampleDocument(
    "letter",
    "letter-classic",
    templateById("letter-classic")?.layout ?? { headerStyle: "left", fontPair: "mixed", showSignature: true },
  );

  return (
    <div className="min-h-dvh bg-paper">
      {/* top bar */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-display text-xl text-ink">
          Letter<span className="text-copper">pad</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/auth/sign-in"
            className="text-sm text-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className={buttonVariants("primary", "sm")}
          >
            Create account
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-6 pb-16 pt-8 sm:gap-12 sm:pb-20 sm:pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.18em] text-copper">
            Letterhead · Quotations · Bills · Letters
          </p>
          <h1 className="font-display text-[2.75rem] leading-[1.05] text-ink sm:text-6xl">
            Your business paperwork,{" "}
            <em className="text-copper">in your hand</em> — ready to send.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            Enter your details once: logo, address, tax ID, bank. Then pick a
            template and write. Every quotation, invoice, payment request and
            letter comes out as a clean PDF with your letterhead, your numbering
            and your totals already correct.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/auth/sign-up" className={buttonVariants("accent", "md")}>
              Create your letterhead
            </Link>
            <Link
              href="/auth/sign-in"
              className="text-sm text-ink underline underline-offset-4 hover:text-copper"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted">
            Email and password — no card, no setup call.
          </p>
        </div>

        <div className="relative">
          <div className="sheet-shadow rotate-[-1.5deg] overflow-hidden rounded-[1px] bg-white transition-transform hover:rotate-0">
            <PdfPreview
              workspace={sampleWorkspace}
              doc={quote}
              contact={sampleContact}
              className="aspect-[1/1.4142] w-full"
            />
          </div>
          <div className="absolute -bottom-8 -left-6 hidden w-40 rotate-[3deg] overflow-hidden rounded-[1px] bg-white shadow-lg ring-1 ring-line sm:block md:-left-4 lg:-left-14 lg:w-48">
            <PdfPreview
              workspace={sampleWorkspace}
              doc={letter}
              className="aspect-[1/1.4142] w-full"
            />
          </div>
        </div>
      </section>

      {/* what it makes */}
      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {MAKES.map((type) => (
            <div key={type} className="bg-white px-6 py-8">
              <p className="font-mono text-xs text-copper">
                {ACRONYM[type]}-0001
              </p>
              <h2 className="mt-2 font-display text-xl text-ink">
                {TYPE_META[type].label}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {TYPE_META[type].blurb}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
        <h2 className="mb-10 max-w-xl font-display text-3xl text-ink">
          Three steps, then it&rsquo;s just writing.
        </h2>
        <ol className="grid gap-8 sm:grid-cols-3">
          {(
            [
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
            ] as const
          ).map(([n, title, body]) => (
            <li key={n}>
              <p className="mb-3 font-mono text-sm text-copper">{n}</p>
              <h3 className="font-display text-xl text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* closing CTA */}
      <section className="bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl text-paper">
              The first document takes about four minutes.
            </h2>
            <p className="mt-1 text-sm text-paper/60">
              Start with your business name — the rest can wait until you need it.
            </p>
          </div>
          <Link
            href="/auth/sign-up"
            className="inline-flex h-11 items-center rounded-[3px] bg-copper px-6 text-sm font-medium text-white hover:bg-copper-soft"
          >
            Create account
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-xs text-muted">
        <p>
          Letter<span className="text-copper">pad</span> — business documents,
          properly papered.
        </p>
        <p>{new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
