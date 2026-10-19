import type { Contact, LetterpadDoc, Workspace } from "@/lib/db/types";
import type { PdfContact, PdfDoc, PdfWorkspace } from "@/pdf/DocumentPdf";
import type { EditorDoc } from "@/components/documents/document-editor";
import type { ContactOption } from "@/components/documents/document-editor";

/** DB row → plain serializable shape for client components. */

export function toPdfWorkspace(ws: Workspace): PdfWorkspace {
  return {
    name: ws.name,
    logo: ws.logo,
    signature: ws.signature,
    addressLine1: ws.addressLine1,
    addressLine2: ws.addressLine2,
    city: ws.city,
    state: ws.state,
    postalCode: ws.postalCode,
    country: ws.country,
    phone: ws.phone,
    email: ws.email,
    website: ws.website,
    taxId: ws.taxId,
    bankDetails: ws.bankDetails,
    brandColor: ws.brandColor,
    brandColors: ws.brandColors,
    taxRate: ws.taxRate,
  };
}

export function toEditorDoc(doc: LetterpadDoc): EditorDoc {
  return {
    id: doc._id.toHexString(),
    number: doc.number,
    type: doc.type,
    templateId: doc.templateId,
    status: doc.status,
    title: doc.title,
    contactId: doc.contactId ? doc.contactId.toHexString() : null,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    currency: doc.currency,
    items: doc.items,
    subtotal: doc.subtotal,
    taxTotal: doc.taxTotal,
    total: doc.total,
    content: doc.content,
    layout: doc.layout,
  };
}

function omitKeys<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const copy = { ...obj } as Record<string, unknown>;
  for (const k of keys) delete copy[k as string];
  return copy as Omit<T, K>;
}

export function toPdfDoc(doc: LetterpadDoc): PdfDoc {
  return omitKeys(toEditorDoc(doc), ["id", "contactId"]);
}

export function toContactOption(c: Contact): ContactOption {
  return {
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
  };
}

export function toPdfContact(c: Contact): PdfContact {
  return omitKeys(toContactOption(c), ["id"]);
}
