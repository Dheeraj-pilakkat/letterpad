import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { ContactDialog } from "@/components/contacts/contact-dialog";
import { EmptyState } from "@/components/ui/card";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage() {
  const { workspace } = await requireWorkspace();
  const contacts = await collections
    .contacts()
    .find({ workspaceId: workspace._id, archived: false })
    .sort({ name: 1 })
    .toArray();

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

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the clients you bill and correspond with — then pick them while writing a document."
          action={<ContactDialog triggerLabel="+ Add your first contact" />}
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
                    }}
                  />
                </p>
                <p className="truncate text-xs text-muted">
                  {[c.companyName, c.email, c.phone].filter(Boolean).join(" · ")}
                </p>
              </div>
              <p className="truncate text-xs text-muted">
                {[c.city, c.country].filter(Boolean).join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
