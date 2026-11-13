import type { Contact, LetterpadDoc } from "@/lib/db/types";

/** JSON-safe document for /api/v1 responses. */
export function apiDocument(doc: LetterpadDoc) {
  return {
    id: doc._id.toHexString(),
    number: doc.number,
    type: doc.type,
    templateId: doc.templateId,
    status: doc.status,
    title: doc.title ?? "",
    issueDate: doc.issueDate,
    dueDate: doc.dueDate ?? null,
    currency: doc.currency,
    subtotal: doc.subtotal,
    discountTotal: doc.discountTotal ?? 0,
    taxTotal: doc.taxTotal,
    total: doc.total,
    contactId: doc.contactId ? doc.contactId.toHexString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** JSON-safe contact for /api/v1 responses. */
export function apiContact(c: Contact) {
  return {
    id: c._id.toHexString(),
    name: c.name,
    companyName: c.companyName ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    postalCode: c.postalCode ?? "",
    country: c.country ?? "",
    taxId: c.taxId ?? "",
    createdAt: c.createdAt.toISOString(),
  };
}
