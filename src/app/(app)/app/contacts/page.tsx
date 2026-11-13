import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import { RestoreContactButton } from "@/components/contacts/restore-button";
import { PortalButton } from "@/components/contacts/portal-button";
import { EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { q, view } = await searchParams;
  const showArchived = view === "archived";

  const filter: Record<string, unknown> = {
    workspaceId: workspace._id,
    archived: showArchived,
  };
  if (q?.trim()) {
    const re = { $regex: q.trim(), $options: "i" };
    filter.$or = [
      { name: re },
      { companyName: re },
      { email: re },
      { phone: re },
    ];
  }

  const contacts = await collections
    .contacts()
    .find(filter)
    .sort({ name: 1 })
    .limit(200)
    .toArray();

  function hrefWith(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { q, view, ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/app/contacts?${s}` : "/app/contacts";
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Contacts</h1>
          <p className="mt-1 text-sm text-muted">
            Clients you send quotations, bills and letters to.
          </p>
        </div>
        <ContactDialog />
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a
          href={hrefWith({ view: undefined })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            !showArchived
              ? "border-ink bg-ink text-paper"
              : "border-line bg-white text-muted hover:border-ink/40",
          )}
        >
          Active
        </a>
        <a
          href={hrefWith({ view: "archived" })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            showArchived
              ? "border-ink bg-ink text-paper"
              : "border-line bg-white text-muted hover:border-ink/40",
          )}
        >
          Archived
        </a>
        <form className="ml-auto w-full sm:w-auto" action="/app/contacts" method="get">
          {showArchived ? <input type="hidden" name="view" value="archived" /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, company, email…"
            className="h-9 w-full rounded-[3px] border border-line bg-white px-3 text-xs text-ink placeholder:text-muted/60 focus:border-royal focus:outline-none sm:w-64"
          />
        </form>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title={showArchived ? "No archived contacts" : q ? "No matches" : "No contacts yet"}
          description={
            showArchived
              ? "Archived clients appear here. Restore one to use them on documents again."
              : q
                ? "Try a different search."
                : "Add the clients you bill and correspond with — then pick them while writing a document."
          }
          action={
            !showArchived && !q ? (
              <ContactDialog triggerLabel="+ Add your first contact" />
            ) : (
              <a
                href={hrefWith({ q: undefined, view: undefined })}
                className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink"
              >
                Clear filters
              </a>
            )
          }
        />
      ) : (
        <div className="divide-y divide-line rounded-[4px] border border-line bg-white">
          {contacts.map((c) => (
            <div
              key={c._id.toHexString()}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {showArchived ? (
                    <span>{c.name}</span>
                  ) : (
                    <ContactDialog
                      contact={{
                        id: c._id.toHexString(),
                        name: c.name,
                        companyName: c.companyName,
                        email: c.email,
                        phone: c.phone,
                        addressLine1: c.addressLine1,
                        addressLine2: c.addressLine2,
                        city: c.city,
                        state: c.state,
                        postalCode: c.postalCode,
                        country: c.country,
                        notes: c.notes,
                        taxId: c.taxId,
                      }}
                    />
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {[c.companyName, c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="truncate text-xs text-muted">
                  {[c.city, c.country].filter(Boolean).join(", ")}
                </p>
                {!showArchived ? (
                  <PortalButton
                    contactId={c._id.toHexString()}
                    enabled={Boolean(c.portalEnabled)}
                    token={c.portalToken}
                  />
                ) : null}
                {showArchived ? (
                  <RestoreContactButton id={c._id.toHexString()} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
