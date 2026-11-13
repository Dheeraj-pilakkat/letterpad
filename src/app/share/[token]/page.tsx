import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedDocument, recordShareView } from "@/lib/actions/sharing";
import { hasPlanFeature } from "@/lib/plans";
import { documentLabel } from "@/lib/templates/registry";
import { formatDate, formatMoney } from "@/lib/utils";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Shared document",
  robots: { index: false, follow: false },
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedDocument(token);
  if (!shared) notFound();
  if (shared.status === "expired") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-4">
        <div className="max-w-md rounded-[4px] border border-line bg-white p-8 text-center shadow-sm">
          <p className="font-display text-xl text-ink">This link has expired</p>
          <p className="mt-2 text-sm text-muted">
            Share links are valid for a limited time. Please ask the sender
            for a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const { doc, workspace, contact } = shared;
  await recordShareView(token);

  const label = documentLabel(doc.type, doc.templateId);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const pdfHref = `${origin}/api/share/${token}/pdf`;
  const whiteLabel =
    workspace.whiteLabel === true && hasPlanFeature(workspace, "whiteLabel");

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            {whiteLabel ? (
              <p className="truncate font-display text-xl text-ink">{workspace.name}</p>
            ) : (
              <p className="font-display text-xl text-ink">
                Letter<span className="text-royal">pad</span>
              </p>
            )}
            <p className="truncate text-xs text-muted">
              {whiteLabel ? "Shared with you" : `Shared by ${workspace.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={doc.type} />
            <StatusBadge status={doc.status} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-[4px] border border-line bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <h1 className="font-display text-2xl text-ink">{doc.number}</h1>
              {doc.title ? (
                <p className="mt-1 text-sm text-muted">{doc.title}</p>
              ) : null}
            </div>
            <div className="text-right text-sm">
              <p className="text-muted">Issued</p>
              <p className="text-ink">{formatDate(doc.issueDate)}</p>
              {doc.dueDate ? (
                <>
                  <p className="mt-2 text-muted">Due</p>
                  <p className="text-ink">{formatDate(doc.dueDate)}</p>
                </>
              ) : null}
            </div>
          </div>

          {contact ? (
            <div className="mb-4 rounded-[3px] bg-paper p-3 text-sm">
              <p className="text-xs text-muted">Prepared for</p>
              <p className="font-medium text-ink">{contact.name}</p>
              {contact.companyName ? (
                <p className="text-muted">{contact.companyName}</p>
              ) : null}
            </div>
          ) : null}

          {doc.items.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3 text-right">Qty</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {doc.items.map((item, i) => (
                    <tr key={`${item.description}-${i}`}>
                      <td className="py-2 pr-3 text-ink">{item.description}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatMoney(item.unitPrice, doc.currency)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-ink">
                        {formatMoney(item.amount, doc.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : doc.content.body ? (
            <div className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {doc.content.body}
            </div>
          ) : null}

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums text-ink">
                {formatMoney(doc.subtotal, doc.currency)}
              </span>
            </div>
            {(doc.discountTotal ?? 0) > 0 ? (
              <div className="flex justify-between text-muted">
                <span>Discount</span>
                <span className="tabular-nums text-ink">
                  −{formatMoney(doc.discountTotal ?? 0, doc.currency)}
                </span>
              </div>
            ) : null}
            {doc.taxTotal > 0 ? (
              <div className="flex justify-between text-muted">
                <span>Tax</span>
                <span className="tabular-nums text-ink">
                  {formatMoney(doc.taxTotal, doc.currency)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 font-medium text-ink">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(doc.total, doc.currency)}
              </span>
            </div>
          </div>

          {doc.content.terms ? (
            <div className="mt-6 border-t border-line pt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">Terms</p>
              <p className="whitespace-pre-wrap text-sm text-muted">
                {doc.content.terms}
              </p>
            </div>
          ) : null}

          {workspace.paymentInstructions || workspace.upiId || workspace.bankDetails ? (
            <div className="mt-4 rounded-[3px] bg-paper p-3 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">
                Payment details
              </p>
              {workspace.upiId ? (
                <p className="text-ink">UPI: {workspace.upiId}</p>
              ) : null}
              {workspace.bankDetails ? (
                <p className="whitespace-pre-wrap text-muted">
                  {workspace.bankDetails}
                </p>
              ) : null}
              {workspace.paymentInstructions ? (
                <p className="mt-1 text-muted">{workspace.paymentInstructions}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={pdfHref}
              className="inline-flex h-10 items-center rounded-[3px] bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-soft"
            >
              Download PDF
            </a>
          </div>
        </div>

        {whiteLabel ? null : (
          <p className="mt-6 text-center text-xs text-muted">
            Powered by{" "}
            <Link href="/" className="text-royal hover:underline">
              Letterpad
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
