import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortal, getPortalPayments } from "@/lib/actions/portal";
import { hasPlanFeature } from "@/lib/plans";
import { documentLabel } from "@/lib/templates/registry";
import { formatDate, formatMoney } from "@/lib/utils";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Document portal",
  robots: { index: false, follow: false },
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const portal = await getPortal(token);
  if (!portal) notFound();

  const { workspace, contact, docs } = portal;
  const payments = await getPortalPayments(token);
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
              {whiteLabel ? "Client portal" : workspace.name}
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <p className="text-ink">{contact.name}</p>
            {contact.companyName ? <p>{contact.companyName}</p> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl text-ink">Your documents</h1>
          <p className="mt-1 text-sm text-muted">
            Shared with you by {workspace.name}. Open a document to view or download the PDF.
          </p>
        </div>

        {docs.length === 0 ? (
          <EmptyState
            title="No documents yet"
            description={`When ${workspace.name} sends you a quotation, bill or letter, it will appear here.`}
          />
        ) : (
          <div className="divide-y divide-line rounded-[4px] border border-line bg-white">
            {docs.map((doc) => {
              const label = documentLabel(doc.type, doc.templateId);
              return (
                <Link
                  key={doc._id.toHexString()}
                  href={`/portal/${token}/${doc._id.toHexString()}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-paper/60"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={doc.type} />
                      <StatusBadge status={doc.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-ink">
                      {doc.number}
                      {doc.title ? ` — ${doc.title}` : ""}
                    </p>
                    <p className="text-xs text-muted">
                      {label} · Issued {formatDate(doc.issueDate)}
                      {doc.dueDate ? ` · Due ${formatDate(doc.dueDate)}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-ink">
                    {formatMoney(doc.total, doc.currency)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        {payments.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-lg text-ink">Payment history</h2>
            <p className="mt-1 text-sm text-muted">Payments received against your documents.</p>
            <div className="mt-3 overflow-x-auto rounded-[4px] border border-line bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Document</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2.5 text-muted">{formatDate(p.date)}</td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/portal/${token}/${p.documentId}`}
                          className="font-medium text-royal hover:underline"
                        >
                          {p.documentNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {p.method}
                        {p.refunded ? " · refunded" : ""}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                        {formatMoney(p.amount, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

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
