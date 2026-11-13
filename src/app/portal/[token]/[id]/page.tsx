import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPortal,
  getPortalBalance,
  getPortalDocument,
  recordPortalView,
} from "@/lib/actions/portal";
import { documentLabel } from "@/lib/templates/registry";
import { hasPlanFeature } from "@/lib/plans";
import { formatDate, formatMoney } from "@/lib/utils";
import { isRazorpayConfigured, razorpayKeyIdFor } from "@/lib/razorpay";
import { loadProfileForDoc } from "@/lib/profiles";
import { overlayBranding } from "@/lib/branding";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { ApproveRejectButtons } from "@/components/portal/approve-reject-buttons";
import { SignaturePanel } from "@/components/portal/signature-panel";
import { PayNowButton } from "@/components/finance/pay-now-button";

export const metadata: Metadata = {
  title: "Document",
  robots: { index: false, follow: false },
};

export default async function PortalDocumentPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const data = await getPortalDocument(token, id);
  if (!data) notFound();
  await recordPortalView(token, id);

  // §6: portal documents render their business profile's branding.
  const profile = await loadProfileForDoc(data.doc);
  const workspace = overlayBranding(data.workspace, profile);
  const { contact, doc } = data;
  const portal = await getPortal(token);
  const label = documentLabel(doc.type, doc.templateId);
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const pdfHref = `${origin}/api/portal/${token}/pdf/${id}`;

  const payable = ["invoice", "quote", "request"].includes(doc.type);
  const balance = payable ? await getPortalBalance(token, id) : null;
  const payKeyId =
    balance && balance.balance > 0 && isRazorpayConfigured(workspace)
      ? razorpayKeyIdFor(workspace)
      : null;

  const recipientLines = [
    contact.companyName,
    contact.addressLine1,
    contact.addressLine2,
    [contact.city, contact.state, contact.postalCode].filter(Boolean).join(" "),
    contact.country,
  ].filter((x): x is string => Boolean(x && x.trim()));

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
              <Link
                href={`/portal/${token}`}
                className="font-display text-xl text-ink"
              >
                Letter<span className="text-royal">pad</span>
              </Link>
            )}
            <p className="truncate text-xs text-muted">
              {whiteLabel ? (
                <Link href={`/portal/${token}`} className="text-royal hover:underline">
                  All documents
                </Link>
              ) : (
                <>
                  {workspace.name} ·{" "}
                  <Link href={`/portal/${token}`} className="text-royal hover:underline">
                    All documents
                  </Link>
                </>
              )}
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
              {doc.title ? <p className="mt-1 text-sm text-muted">{doc.title}</p> : null}
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

          <div className="mb-4 rounded-[3px] bg-paper p-3 text-sm">
            <p className="text-xs text-muted">Prepared for</p>
            <p className="font-medium text-ink">{contact.name}</p>
            {recipientLines.map((line) => (
              <p key={line} className="text-muted">{line}</p>
            ))}
          </div>

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
                      <td className="py-2 pr-3 text-right tabular-nums">{item.quantity}</td>
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
              <span className="tabular-nums">{formatMoney(doc.total, doc.currency)}</span>
            </div>
          </div>

          {doc.content.terms ? (
            <div className="mt-6 border-t border-line pt-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">Terms</p>
              <p className="whitespace-pre-wrap text-sm text-muted">{doc.content.terms}</p>
            </div>
          ) : null}

          {(workspace.paymentInstructions || workspace.upiId || workspace.bankDetails) ? (
            <div className="mt-4 rounded-[3px] bg-paper p-3 text-sm">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted">Payment details</p>
              {workspace.upiId ? <p className="text-ink">UPI: {workspace.upiId}</p> : null}
              {workspace.bankDetails ? (
                <p className="whitespace-pre-wrap text-muted">{workspace.bankDetails}</p>
              ) : null}
              {workspace.paymentInstructions ? (
                <p className="mt-1 text-muted">{workspace.paymentInstructions}</p>
              ) : null}
            </div>
          ) : null}

          {balance && balance.balance > 0 ? (
            <div className="mt-4 rounded-[3px] bg-paper p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Paid</span>
                <span className="tabular-nums text-ink">
                  {formatMoney(balance.paid, balance.currency)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-medium">
                <span className="text-ink">Balance due</span>
                <span className="tabular-nums text-ink">
                  {formatMoney(balance.balance, balance.currency)}
                </span>
              </div>
              {payKeyId ? (
                <div className="mt-3">
                  <PayNowButton
                    documentId={id}
                    keyId={payKeyId}
                    balance={balance.balance}
                    currency={balance.currency}
                    docNumber={doc.number}
                    portalToken={token}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Pay by bank transfer or UPI using the details above.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <ApproveRejectButtons
              token={token}
              documentId={id}
              status={doc.status}
              docNumber={doc.number}
            />
            <SignaturePanel
              token={token}
              documentId={id}
              requested={Boolean(doc.signatureRequested)}
              signature={
                doc.signature
                  ? { ...doc.signature, signedAt: doc.signature.signedAt.toISOString() }
                  : null
              }
              defaultName={contact.name}
            />
            <div>
              <a
                href={pdfHref}
                className="inline-flex h-10 items-center rounded-[3px] bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-soft"
              >
                Download PDF
              </a>
            </div>
          </div>
        </div>

        {portal ? (
          <p className="mt-6 text-center text-xs text-muted">
            {portal.docs.length} document{portal.docs.length === 1 ? "" : "s"} shared with you
          </p>
        ) : null}
      </main>
    </div>
  );
}
