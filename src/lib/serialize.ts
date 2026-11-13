import type { BusinessProfile, Contact, LetterpadDoc, Payment, Workspace } from "@/lib/db/types";
import type { PdfContact, PdfDoc, PdfWorkspace } from "@/pdf/DocumentPdf";
import type { EditorDoc } from "@/components/documents/document-editor";
import type { ContactOption } from "@/components/documents/document-editor";
import { overlayBranding } from "@/lib/branding";

/** DB row → plain serializable shape for client components. */

/**
 * Workspace branding → PDF shape. Pass the document's business profile (§6)
 * to overlay its branding over the workspace defaults.
 */
export function toPdfWorkspace(
  ws: Workspace,
  profile?: BusinessProfile | null,
): PdfWorkspace {
  const b = overlayBranding(ws, profile);
  return {
    name: b.name,
    logo: b.logo,
    signature: b.signature,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    country: b.country,
    phone: b.phone,
    email: b.email,
    website: b.website,
    taxId: b.taxId,
    pan: b.pan,
    upiId: b.upiId,
    paymentInstructions: b.paymentInstructions,
    bankDetails: b.bankDetails,
    brandColor: b.brandColor,
    brandColors: b.brandColors,
    taxRate: b.taxRate,
    taxLabel: b.taxConfig?.label,
    gstEnabled: b.gstEnabled,
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
    discountTotal: doc.discountTotal ?? 0,
    taxTotal: doc.taxTotal,
    total: doc.total,
    discount: doc.discount,
    gst: doc.gst ?? undefined,
    reverseCharge: doc.reverseCharge,
    content: doc.content,
    layout: doc.layout,
    shareEnabled: doc.shareEnabled ?? false,
    shareExpiresAt: doc.shareExpiresAt
      ? new Date(doc.shareExpiresAt).toISOString()
      : null,
    signatureRequested: doc.signatureRequested ?? false,
    signature: doc.signature
      ? {
          signedBy: doc.signature.signedBy,
          method: doc.signature.method,
          image: doc.signature.image,
          text: doc.signature.text,
          signedAt: doc.signature.signedAt.toISOString(),
          ip: doc.signature.ip,
        }
      : undefined,
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
    taxId: c.taxId,
  };
}

export function toPdfContact(c: Contact): PdfContact {
  return omitKeys(toContactOption(c), ["id"]);
}

export interface PaymentDTO {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference?: string;
  notes?: string;
  refunded: boolean;
}

export function toPaymentDTO(p: Payment): PaymentDTO {
  return {
    id: p._id.toHexString(),
    amount: p.amount,
    date: p.date,
    method: p.method,
    reference: p.reference,
    notes: p.notes,
    refunded: p.refunded ?? false,
  };
}
