import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { toPdfDoc } from "@/lib/serialize";
import { TYPE_META, DOCUMENT_TYPES } from "@/lib/templates/registry";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { StatusBadge, TypeBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { RestoreDocumentButton } from "@/components/documents/restore-button";
import type { DocumentStatus, DocumentType } from "@/lib/db/types";

export const metadata: Metadata = { title: "Documents" };

const ALL_STATUSES: Array<DocumentStatus | "all"> = [
  "all",
  "draft",
  "sent",
  "viewed",
  "paid",
  "accepted",
  "rejected",
  "expired",
  "overdue",
  "void",
];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string; view?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { type, status, q, view } = await searchParams;
  const trash = view === "trash";

  const filter: Record<string, unknown> = { workspaceId: workspace._id };
  if (trash) {
    filter.deletedAt = { $ne: null };
  } else {
    filter.deletedAt = null;
  }
  if (type && DOCUMENT_TYPES.includes(type as DocumentType)) {
    filter.type = type;
  }
  if (status && status !== "all") filter.status = status;
  if (q?.trim()) {
    filter.$or = [
      { number: { $regex: q.trim(), $options: "i" } },
      { title: { $regex: q.trim(), $options: "i" } },
    ];
  }

  const docs = await collections
    .documents()
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();

  function hrefWith(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { type, status, q, view, ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "all") sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/app/documents?${s}` : "/app/documents";
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">
            {trash ? "Trash" : "Documents"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {trash
              ? "Trashed documents stay here until you restore them."
              : "Quotations, bills, requests, receipts and letters."}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={hrefWith({ view: trash ? undefined : "trash" })}
            className="inline-flex h-10 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink hover:border-ink/40"
          >
            {trash ? "← Live documents" : "Trash"}
          </Link>
          {!trash ? (
            <Link
              href="/app/documents/new"
              className="inline-flex h-10 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
            >
              + New document
            </Link>
          ) : null}
        </div>
      </header>

      {/* filters */}
      {!trash ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {DOCUMENT_TYPES.map((t) => (
            <Link
              key={t}
              href={hrefWith({ type: type === t ? undefined : t })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                type === t
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-white text-muted hover:border-ink/40",
              )}
            >
              {TYPE_META[t].plural}
            </Link>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
          {ALL_STATUSES.map((s) => (
            <Link
              key={s}
              href={hrefWith({ status: s === "all" ? undefined : s })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                (status ?? "all") === s
                  ? "border-royal bg-royal/10 text-royal"
                  : "border-line bg-white text-muted hover:border-ink/40",
              )}
            >
              {s}
            </Link>
          ))}
          <form className="ml-auto w-full sm:w-auto" action="/app/documents" method="get">
            {type ? <input type="hidden" name="type" value={type} /> : null}
            {status ? <input type="hidden" name="status" value={status} /> : null}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search number or title…"
              className="h-9 w-full rounded-[3px] border border-line bg-white px-3 text-xs text-ink placeholder:text-muted/60 focus:border-royal focus:outline-none sm:w-56"
            />
          </form>
        </div>
      ) : null}

      {docs.length === 0 ? (
        <EmptyState
          title={trash ? "Trash is empty" : "No documents here"}
          description={
            trash
              ? "Deleted documents appear here and can be restored."
              : q || type || status
                ? "Try clearing the filters, or create a new document."
                : "Pick a template and create your first quotation, bill or letter."
          }
          action={
            !trash ? (
              <Link
                href="/app/documents/new"
                className="inline-flex h-9 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
              >
                New document
              </Link>
            ) : (
              <Link
                href="/app/documents"
                className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink"
              >
                Back to documents
              </Link>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
          <table className="w-full min-w-[30rem] text-sm sm:min-w-[44rem]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Type</th>
                <th className="px-4 py-3 font-medium">Title / client</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Date</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {trash ? <th className="px-4 py-3 font-medium">Action</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {docs.map((doc) => {
                const d = toPdfDoc(doc);
                const date = new Date(doc.updatedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const id = doc._id.toHexString();
                return (
                  <tr key={id} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      {trash ? (
                        <span className="font-medium text-ink">{doc.number}</span>
                      ) : (
                        <Link
                          href={`/app/documents/${id}`}
                          className="font-medium text-ink hover:text-royal"
                        >
                          {doc.number}
                        </Link>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <TypeBadge type={doc.type} />
                    </td>
                    <td className="max-w-48 px-4 py-3 text-ink sm:max-w-64">
                      <span className="mb-1 block truncate">
                        {doc.title || "—"}
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted sm:hidden">
                        <TypeBadge type={doc.type} />
                        {date}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{date}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">
                      {d.total > 0 ? formatMoney(d.total, d.currency) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    {trash ? (
                      <td className="px-4 py-3">
                        <RestoreDocumentButton id={id} />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
