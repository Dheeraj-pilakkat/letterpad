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
import type { DocumentStatus, DocumentType } from "@/lib/db/types";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { type, status, q } = await searchParams;

  const filter: Record<string, unknown> = { workspaceId: workspace._id };
  if (type && DOCUMENT_TYPES.includes(type as DocumentType)) {
    filter.type = type;
  }
  if (status) filter.status = status;
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

  const statuses: Array<DocumentStatus | "all"> = [
    "all",
    "draft",
    "sent",
    "paid",
    "accepted",
    "void",
  ];

  function hrefWith(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { type, status, q, ...params };
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
          <h1 className="font-display text-3xl text-ink">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Quotations, bills, requests, receipts and letters.
          </p>
        </div>
        <Link
          href="/app/documents/new"
          className="inline-flex h-10 items-center rounded-[3px] bg-copper px-4 text-sm font-medium text-white hover:bg-copper-soft"
        >
          + New document
        </Link>
      </header>

      {/* filters */}
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
        {statuses.map((s) => (
          <Link
            key={s}
            href={hrefWith({ status: s === "all" ? undefined : s })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
              (status ?? "all") === s
                ? "border-copper bg-copper/10 text-copper"
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
            className="h-9 w-full rounded-[3px] border border-line bg-white px-3 text-xs text-ink placeholder:text-muted/60 focus:border-copper focus:outline-none sm:w-56"
          />
        </form>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          title="No documents here"
          description={
            q || type || status
              ? "Try clearing the filters, or create a new document."
              : "Pick a template and create your first quotation, bill or letter."
          }
          action={
            <Link
              href="/app/documents/new"
              className="inline-flex h-9 items-center rounded-[3px] bg-copper px-4 text-sm font-medium text-white hover:bg-copper-soft"
            >
              New document
            </Link>
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
                return (
                  <tr key={doc._id.toHexString()} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/documents/${doc._id.toHexString()}`}
                        className="font-medium text-ink hover:text-copper"
                      >
                        {doc.number}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <TypeBadge type={doc.type} />
                    </td>
                    <td className="max-w-48 px-4 py-3 text-ink sm:max-w-64">
                      <span className="mb-1 block truncate">
                        {doc.title || "—"}
                      </span>
                      {/* type + date fold into the title cell on phones */}
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
