"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Download,
  Link2,
  Loader2,
  Mail,
  PenLine,
  Trash2,
  X,
} from "lucide-react";
import type { CustomColumn, DocumentStatus, DocumentType, LineItemColumns } from "@/lib/db/types";
import type { PdfContact, PdfDoc, PdfWorkspace } from "@/pdf/DocumentPdf";
import type { PaymentDTO } from "@/lib/serialize";
import {
  deleteDocument,
  duplicateDocument,
  updateDocument,
  updateDocumentStatus,
} from "@/lib/actions/documents";
import {
  disableShare,
  emailDocument,
  enableShare,
  sendReviewRequestAction,
} from "@/lib/actions/sharing";
import { convertToInvoiceAction } from "@/lib/actions/workflows";
import { templatesForType } from "@/lib/templates/registry";
import type { DocumentInput } from "@/lib/validation/schemas";
import { computeTotals } from "@/lib/validation/schemas";
import { CURRENCIES, STATUS_LABELS, VALID_TRANSITIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/badge";
import { LineItems, type ItemDraft } from "@/components/documents/line-items";
import { PaymentsPanel } from "@/components/documents/payments-panel";
import { PdfPreview } from "@/components/documents/pdf-preview";
import { AiPanel } from "@/components/documents/ai-panel";
import { DeliveryPanel, type DeliveryDTO } from "@/components/documents/delivery-panel";
import { WhatsAppButton } from "@/components/documents/whatsapp-button";

export interface EditorDoc extends PdfDoc {
  id: string;
  contactId: string | null;
  shareEnabled?: boolean;
  /** ISO expiry of the current share link, if any */
  shareExpiresAt?: string | null;
}

export interface ContactOption extends PdfContact {
  id: string;
}

export function DocumentEditor({
  workspace,
  doc,
  contacts,
  activity,
  payments,
  razorpayKeyId,
  deliveries,
  aiEnabled,
}: {
  workspace: PdfWorkspace;
  doc: EditorDoc;
  contacts: ContactOption[];
  activity?: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
  payments?: PaymentDTO[];
  razorpayKeyId?: string | null;
  deliveries?: DeliveryDTO[];
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [sharePending, startShare] = useTransition();
  const [converting, startConvert] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  const template = templatesForType(doc.type).find((t) => t.id === doc.templateId);
  const kind = template?.kind ?? (doc.items.length ? "itemized" : "prose");

  const [title, setTitle] = useState(doc.title ?? "");
  const [templateId, setTemplateId] = useState(doc.templateId);
  const [contactId, setContactId] = useState(doc.contactId ?? "");
  const [issueDate, setIssueDate] = useState(doc.issueDate);
  const [dueDate, setDueDate] = useState(doc.dueDate ?? "");
  const [currency, setCurrency] = useState(doc.currency);
  const [status, setStatus] = useState<DocumentStatus>(doc.status);
  const [subject, setSubject] = useState(doc.content.subject ?? "");
  const [body, setBody] = useState(doc.content.body ?? "");
  const [terms, setTerms] = useState(doc.content.terms ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    doc.items.map(({ description, quantity, unitPrice, taxRate, values }) => ({
      description,
      quantity,
      unitPrice,
      taxRate,
      values: values ? { ...values } : undefined,
    })),
  );
  const [discountType, setDiscountType] = useState<"percent" | "amount">(
    doc.discount?.type ?? "percent",
  );
  const [discountValue, setDiscountValue] = useState(
    String(doc.discount?.value ?? ""),
  );
  const [shareEnabled, setShareEnabled] = useState(doc.shareEnabled ?? false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(
    doc.shareExpiresAt ?? null,
  );
  const [emailTo, setEmailTo] = useState(
    contacts.find((c) => c.id === (doc.contactId ?? ""))?.email ?? "",
  );
  const [emailOpen, setEmailOpen] = useState(false);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    doc.layout.customColumns ?? [],
  );
  const [columns, setColumns] = useState<LineItemColumns>({
    qty: doc.layout.columns?.qty ?? true,
    unitPrice: doc.layout.columns?.unitPrice ?? true,
    tax: doc.layout.columns?.tax ?? true,
  });
  const [accentColor, setAccentColor] = useState(
    doc.layout.accentColor ?? workspace.brandColor,
  );
  const palette =
    workspace.brandColors?.length && workspace.brandColors.length > 0
      ? workspace.brandColors
      : [workspace.brandColor];

  const activeTemplate = useMemo(
    () => templatesForType(doc.type).find((t) => t.id === templateId),
    [doc.type, templateId],
  );
  const activeKind = activeTemplate?.kind ?? "prose";

  const discountPayload = useMemo(() => {
    const n = Number(discountValue);
    if (!discountValue || Number.isNaN(n) || n <= 0) return undefined;
    if (discountType === "percent" && n > 100) return undefined;
    return { type: discountType, value: n } as const;
  }, [discountType, discountValue]);

  const previewDoc: PdfDoc = (() => {
    const liveItems =
      activeKind === "itemized"
        ? items.map((item) => ({
            ...item,
            amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
          }))
        : [];
    const totals = computeTotals(liveItems, discountPayload);
    return {
      number: doc.number,
      type: doc.type,
      templateId,
      status,
      title,
      issueDate,
      dueDate: dueDate || undefined,
      currency,
      items: liveItems,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      discount: discountPayload,
      content: { subject, body, terms },
      layout: {
        ...activeTemplate?.layout,
        accentColor,
        columns,
        customColumns,
      },
    };
  })();

  const activeContact = contacts.find((c) => c.id === contactId) ?? null;

  const allowedTargets = VALID_TRANSITIONS[status] ?? [];

  function save() {
    setError(null);
    setFlash(null);
    startSave(async () => {
      const payload: DocumentInput = {
        title,
        templateId,
        contactId,
        issueDate,
        dueDate,
        currency: currency as DocumentInput["currency"],
        content: { subject, body, terms },
        items:
          activeKind === "itemized"
            ? items.filter((i) => i.description.trim())
            : [],
        columns,
        accentColor,
        customColumns,
        discount: discountPayload,
      };
      const res = await updateDocument(doc.id, payload);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setFlash("Saved");
      setTimeout(() => setFlash(null), 2000);
      router.refresh();
    });
  }

  function changeStatus(to: DocumentStatus) {
    startStatus(async () => {
      const res = await updateDocumentStatus(doc.id, to);
      if (!res.ok) {
        setError(res.error ?? "Failed to update status");
        return;
      }
      setStatus(to);
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!confirm("Move this document to trash? You can restore it later."))
      return;
    const res = await deleteDocument(doc.id);
    if (res.ok) router.push("/app/documents");
    else setError(res.error ?? "Failed to delete");
  }

  async function handleDuplicate() {
    const res = await duplicateDocument(doc.id);
    if (res.ok && res.id) router.push(`/app/documents/${res.id}`);
    else setError(res.error ?? "Failed to duplicate");
  }

  function toggleShare() {
    setError(null);
    startShare(async () => {
      if (shareEnabled) {
        const res = await disableShare(doc.id);
        if (!res.ok) {
          setError(res.error ?? "Failed to disable sharing");
          return;
        }
        setShareEnabled(false);
        setShareUrl(null);
        setShareExpiresAt(null);
      } else {
        const res = await enableShare(doc.id);
        if (!res.ok || !res.url) {
          setError(res.error ?? "Failed to enable sharing");
          return;
        }
        setShareEnabled(true);
        setShareUrl(res.url);
        setShareExpiresAt(res.expiresAt ?? null);
        await navigator.clipboard?.writeText(res.url).catch(() => undefined);
        setFlash("Share link copied");
        setTimeout(() => setFlash(null), 2500);
      }
      router.refresh();
    });
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setFlash("Copied");
    setTimeout(() => setFlash(null), 1500);
  }

  function sendEmail() {
    setError(null);
    startShare(async () => {
      const res = await emailDocument({ id: doc.id, to: emailTo });
      if (!res.ok) {
        setError(res.error ?? "Failed to email");
        return;
      }
      if (res.url) {
        setShareEnabled(true);
        setShareUrl(res.url);
        if (res.expiresAt) setShareExpiresAt(res.expiresAt);
      }
      if (res.mode === "mailto" && res.mailto) {
        window.location.href = res.mailto;
        setFlash("Opened your email app");
      } else {
        setFlash("Email sent");
        setEmailOpen(false);
      }
      setTimeout(() => setFlash(null), 2500);
      router.refresh();
    });
  }

  function sendReviewRequest(kind: "approval" | "signature") {
    setError(null);
    startShare(async () => {
      const res = await sendReviewRequestAction(doc.id, kind);
      if (!res.ok) {
        setError(res.error ?? "Failed to send request");
        return;
      }
      if (res.url) {
        setShareEnabled(true);
        setShareUrl(res.url);
      }
      if (res.mode === "mailto" && res.mailto) {
        window.location.href = res.mailto;
        setFlash(
          kind === "signature"
            ? "Signature request draft opened"
            : "Approval request draft opened",
        );
      } else {
        setFlash(
          kind === "signature" ? "Signature request sent" : "Approval request sent",
        );
        setEmailOpen(false);
      }
      setTimeout(() => setFlash(null), 2500);
      router.refresh();
    });
  }

  /** Apply an AI draft to one of the text slots (local state — Save persists). */
  function applyAi(slot: "subject" | "body" | "terms", text: string) {
    if (slot === "subject") setSubject(text);
    else if (slot === "body") setBody(text);
    else setTerms(text);
    setFlash("AI draft applied — press Save to keep it");
    setTimeout(() => setFlash(null), 3000);
  }

  /** §15 workflow: quotation → invoice. */
  function handleConvert() {
    setError(null);
    startConvert(async () => {
      const res = await convertToInvoiceAction(doc.id);
      if (res.ok && res.id) {
        router.push(`/app/documents/${res.id}`);
        return;
      }
      setError(res.error ?? "Failed to convert quotation");
    });
  }

  const convertEligible =
    doc.type === "quote" && !["void", "rejected", "draft"].includes(status);

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/app/documents" className="text-sm text-muted hover:text-ink">
            ← Documents
          </Link>
          <h1 className="font-display text-2xl text-ink">{doc.number}</h1>
          <StatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {flash ? (
            <span className="flex items-center gap-1 text-sm text-forest">
              <Check size={14} /> {flash}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleShare}
            disabled={sharePending}
          >
            <Link2 size={14} /> {shareEnabled ? "Sharing on" : "Share"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailOpen((v) => !v)}
          >
            <Mail size={14} /> Email
          </Button>
          <WhatsAppButton
            docId={doc.id}
            hasPhone={Boolean(activeContact?.phone)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => sendReviewRequest("signature")}
            disabled={sharePending}
            title="Email the client a request to sign this document"
          >
            {sharePending ? <Loader2 size={14} className="animate-spin" /> : null}
            <PenLine size={14} />{" "}
            {doc.signature ? "Signed" : doc.signatureRequested ? "Resend signature request" : "Request signature"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate}>
            <Copy size={14} /> Duplicate
          </Button>
          <a
            href={`/api/documents/${doc.id}/pdf`}
            className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-ink px-3 text-xs font-medium text-paper hover:bg-ink-soft"
          >
            <Download size={14} /> Download PDF
          </a>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-[3px] bg-red/10 px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}

      {emailOpen ? (
        <div className="mb-5 rounded-[4px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Send to" className="min-w-48 flex-1">
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="client@example.com"
              />
            </Field>
            <Button size="sm" onClick={sendEmail} disabled={sharePending}>
              {sharePending ? <Loader2 size={14} className="animate-spin" /> : null}
              Send
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendReviewRequest("approval")}
              disabled={sharePending}
              title="Email a review-and-approve request"
            >
              Send approval request
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEmailOpen(false)}>
              <X size={14} /> Close
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Includes a secure view link. Uses your email provider when configured;
            otherwise opens your mail app.
          </p>
        </div>
      ) : null}

      {shareEnabled ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-[4px] border border-royal/30 bg-royal/5 px-3 py-2 text-sm">
          <Link2 size={14} className="shrink-0 text-royal" />
          <a
            href={shareUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="truncate text-royal underline underline-offset-2"
          >
            {shareUrl ?? "Share link active"}
          </a>
          {shareUrl ? (
            <Button variant="ghost" size="sm" onClick={copyShare}>
              Copy
            </Button>
          ) : null}
          {shareExpiresAt ? (
            <span className="ml-auto shrink-0 text-xs text-muted">
              Expires{" "}
              {new Date(shareExpiresAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* mobile: switch between the form and the full-screen preview */}
      <div
        className="mb-5 flex rounded-[4px] border border-line bg-white p-1 lg:hidden"
        role="group"
        aria-label="Editor view"
      >
        {(
          [
            ["edit", "Edit"],
            ["preview", "Preview"],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            aria-pressed={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={cn(
              "min-h-9 flex-1 rounded-[3px] text-sm font-medium transition-colors",
              mobileTab === tab
                ? "bg-ink text-paper"
                : "text-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:gap-8">
        {/* ---- form column ---- */}
        <div
          className={cn("space-y-6", mobileTab === "preview" && "hidden lg:block")}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Template">
              <Select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {templatesForType(doc.type).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">
              Accent colour{" "}
              <span className="font-normal text-muted">
                (from your brand palette)
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {palette.map((c) => (
                <button
                  key={c.toUpperCase()}
                  type="button"
                  onClick={() => setAccentColor(c)}
                  aria-label={`Accent colour ${c}`}
                  aria-pressed={accentColor.toLowerCase() === c.toLowerCase()}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    accentColor.toLowerCase() === c.toLowerCase()
                      ? "scale-110 border-ink"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <span className="ml-1 font-mono text-xs text-muted">{accentColor}</span>
            </div>
          </div>

          <Field label="Title (internal)">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brand identity for Blue Fern"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Select value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">— No client —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.companyName ? ` · ${c.companyName}` : ""}
                  </option>
                ))}
              </Select>
              {contacts.length === 0 ? (
                <Link href="/app/contacts" className="mt-1 block text-xs text-royal underline underline-offset-2">
                  Add a contact first
                </Link>
              ) : null}
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Issue date">
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
              </Field>
              {activeKind === "itemized" ? (
                <Field label="Due date">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
              ) : (
                <div />
              )}
            </div>
          </div>

          {activeKind === "itemized" ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-ink">Line items</h2>
                <div
                  className="flex flex-wrap items-center gap-3 text-xs text-ink-soft"
                  role="group"
                  aria-label="Table columns"
                >
                  <span className="text-muted">Columns:</span>
                  {(
                    [
                      ["qty", "Qty"],
                      ["unitPrice", "Unit price"],
                      ["tax", "Tax"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer select-none items-center gap-1.5"
                    >
                      <input
                        type="checkbox"
                        checked={columns[key] ?? true}
                        onChange={(e) =>
                          setColumns((c) => ({ ...c, [key]: e.target.checked }))
                        }
                        className="size-3.5 accent-royal"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <LineItems
                items={items}
                onChange={setItems}
                currency={currency}
                defaultTaxRate={workspace.taxRate}
                columns={columns}
                customColumns={customColumns}
                onCustomColumnsChange={setCustomColumns}
              />

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Discount type">
                  <Select
                    value={discountType}
                    onChange={(e) =>
                      setDiscountType(e.target.value as "percent" | "amount")
                    }
                  >
                    <option value="percent">Percent (%)</option>
                    <option value="amount">Fixed amount</option>
                  </Select>
                </Field>
                <Field label="Discount value">
                  <Input
                    type="number"
                    min={0}
                    max={discountType === "percent" ? 100 : undefined}
                    step="0.01"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                  />
                </Field>
                <div className="flex items-end pb-1 text-xs text-muted">
                  Applied to subtotal before tax
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-4">
              <Field label="Subject">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Request for site access next week"
                />
              </Field>
              <Field label="Letter body">
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={10}
                  placeholder={"Dear …,\n\nWrite your letter here.\n\nKind regards,"}
                />
              </Field>
            </section>
          )}

          <Field label="Terms & notes" hint="Shown at the bottom of the document">
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              placeholder="Quotation valid for 30 days. 50% advance to begin work."
            />
          </Field>

          {aiEnabled ? (
            <AiPanel
              docType={doc.type}
              subject={subject}
              body={body}
              terms={terms}
              context={[
                `${doc.number} (${workspace.name})`,
                activeContact ? `Client: ${activeContact.name}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              onApply={applyAi}
            />
          ) : null}

          {/* status controls */}
          <section className="rounded-[4px] border border-line bg-white p-4">
            <h2 className="mb-1 text-sm font-medium text-ink">Status</h2>
            <p className="mb-3 text-xs text-muted">
              Current: <span className="capitalize">{STATUS_LABELS[status]}</span>.
              Move the document along as you send it and get paid.
            </p>
            <div className="flex flex-wrap gap-2">
              {allowedTargets
                .filter((to) => to !== status)
                .map((to) => (
                  <Button
                    key={to}
                    variant="outline"
                    size="sm"
                    disabled={statusPending}
                    onClick={() => changeStatus(to)}
                  >
                    {to === "draft" ? "Reopen draft" : `Mark as ${STATUS_LABELS[to].toLowerCase()}`}
                  </Button>
                ))}
              {convertEligible ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={converting}
                  onClick={handleConvert}
                  title="Create a draft invoice from this quotation"
                >
                  {converting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Convert to invoice
                </Button>
              ) : null}
            </div>
          </section>

          {/* payments */}
          {(["invoice", "quote", "request"] as DocumentType[]).includes(doc.type) ? (
            <PaymentsPanel
              docId={doc.id}
              docNumber={doc.number}
              docType={doc.type}
              total={doc.total}
              currency={currency}
              status={status}
              payments={payments ?? []}
              razorpayKeyId={razorpayKeyId}
              contactEmail={
                contacts.find((c) => c.id === (doc.contactId ?? ""))?.email ?? undefined
              }
            />
          ) : null}

          {/* scheduled delivery */}
          <DeliveryPanel
            docId={doc.id}
            defaultTo={
              contacts.find((c) => c.id === (doc.contactId ?? ""))?.email ?? undefined
            }
            deliveries={deliveries ?? []}
          />

          {/* activity */}
          {activity && activity.length > 0 ? (
            <section className="rounded-[4px] border border-line bg-white p-4">
              <h2 className="mb-3 text-sm font-medium text-ink">Activity</h2>
              <ol className="space-y-2">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-ink">{a.message}</span>
                    <time className="shrink-0 text-muted">
                      {new Date(a.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <div className="flex justify-end">
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 size={14} /> Move to trash
            </Button>
          </div>
        </div>

        {/* ---- preview column ---- */}
        <div
          className={cn(
            "lg:sticky lg:top-8 lg:block lg:self-start",
            mobileTab === "edit" && "hidden",
          )}
        >
          <p className="mb-2 text-xs font-medium text-muted">
            Live PDF preview — this is exactly what downloads
            {activeContact ? ` · prepared for ${activeContact.name}` : ""}
          </p>
          <div className="sheet-shadow overflow-hidden rounded-[2px] border border-line">
            <PdfPreview
              workspace={workspace}
              doc={previewDoc}
              contact={activeContact}
              className="aspect-[1/1.4142] w-full"
            />
          </div>
          {kind === "itemized" && activeKind === "prose" ? (
            <p className="mt-2 text-xs text-amber-ink">
              Switching to a prose template removes line items from this document.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
