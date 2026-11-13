import type {
  DocumentType,
  FontPair,
  HeaderStyle,
  TemplateKind,
  TemplateLayout,
} from "@/lib/db/types";

export interface TemplateDef {
  id: string;
  type: DocumentType;
  name: string;
  kind: TemplateKind;
  description: string;
  layout: TemplateLayout;
  /** Requires the Starter plan or higher (§20 premium templates) */
  premium?: boolean;
}

export const TYPE_META: Record<
  DocumentType,
  { label: string; plural: string; blurb: string }
> = {
  quote: {
    label: "Quotation",
    plural: "Quotations",
    blurb: "Price out a job with line items, tax and a validity date.",
  },
  invoice: {
    label: "Bill",
    plural: "Bills",
    blurb: "Request payment for work completed, with bank details attached.",
  },
  request: {
    label: "Request",
    plural: "Requests",
    blurb: "Ask for a payment or send a formal request on your letterhead.",
  },
  receipt: {
    label: "Receipt",
    plural: "Receipts",
    blurb: "Acknowledge a payment against an invoice or order.",
  },
  letter: {
    label: "Letter",
    plural: "Letters",
    blurb: "Any formal correspondence, printed on your stationery.",
  },
  creditNote: {
    label: "Credit Note",
    plural: "Credit Notes",
    blurb: "Reduce a bill for returns, cancelled work or agreed discounts.",
  },
  debitNote: {
    label: "Debit Note",
    plural: "Debit Notes",
    blurb: "Record an extra charge against a client after the bill.",
  },
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "quote-classic",
    type: "quote",
    name: "Classic Quote",
    kind: "itemized",
    description: "Serif letterhead with a left-aligned masthead.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
  {
    id: "quote-modern",
    type: "quote",
    name: "Modern Quote",
    kind: "itemized",
    description: "Bold accent band with clean sans-serif table.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "quote-center",
    type: "quote",
    name: "Centered Quote",
    kind: "itemized",
    description: "Centred masthead, airy sans table — light and open.",
    layout: { headerStyle: "center", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "invoice-classic",
    type: "invoice",
    name: "Classic Bill",
    kind: "itemized",
    description: "Traditional masthead, totals block and bank details.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
  {
    id: "invoice-modern",
    type: "invoice",
    name: "Modern Bill",
    kind: "itemized",
    description: "Accent band header with a prominent amount due.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "invoice-center",
    type: "invoice",
    name: "Centered Bill",
    kind: "itemized",
    description: "Centred letterhead with serif numbers and clean totals.",
    layout: { headerStyle: "center", fontPair: "mixed", showLogo: true },
    premium: true,
  },
  {
    id: "invoice-proforma",
    type: "invoice",
    name: "Proforma Invoice",
    kind: "itemized",
    description:
      "Pre-shipment proforma on the classic bill layout — shares the INV number sequence.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
  {
    id: "request-payment",
    type: "request",
    name: "Payment Request",
    kind: "itemized",
    description: "A polite, itemised request for payment with a due date.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
  {
    id: "request-modern",
    type: "request",
    name: "Modern Payment Request",
    kind: "itemized",
    description: "Accent band masthead for a direct, contemporary ask.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "request-letter",
    type: "request",
    name: "Formal Request Letter",
    kind: "prose",
    description: "A formal letter for requests, approvals or documents.",
    layout: { headerStyle: "left", fontPair: "serif", showLogo: true, showSignature: true },
    premium: true,
  },
  {
    id: "receipt-classic",
    type: "receipt",
    name: "Classic Receipt",
    kind: "itemized",
    description: "Centred masthead with a paid acknowledgement.",
    layout: { headerStyle: "center", fontPair: "sans", showLogo: true },
  },
  {
    id: "receipt-modern",
    type: "receipt",
    name: "Modern Receipt",
    kind: "itemized",
    description: "Bold accent band with a crisp payment confirmation.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "receipt-minimal",
    type: "receipt",
    name: "Minimal Receipt",
    kind: "itemized",
    description: "Serif, no logo — pure typographic acknowledgement.",
    layout: { headerStyle: "center", fontPair: "serif", showLogo: false },
    premium: true,
  },
  {
    id: "letter-classic",
    type: "letter",
    name: "Classic Letter",
    kind: "prose",
    description: "Timeless stationery: mixed type, signature block.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true, showSignature: true },
  },
  {
    id: "letter-modern",
    type: "letter",
    name: "Modern Letter",
    kind: "prose",
    description: "Accent band masthead, clean sans body.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true, showSignature: true },
    premium: true,
  },
  {
    id: "letter-minimal",
    type: "letter",
    name: "Minimal Letter",
    kind: "prose",
    description: "Centred, serif, no logo — pure typography.",
    layout: { headerStyle: "center", fontPair: "serif", showSignature: true },
    premium: true,
  },
  {
    id: "credit-note-classic",
    type: "creditNote",
    name: "Classic Credit Note",
    kind: "itemized",
    description: "Traditional masthead adjusting an original bill.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
  {
    id: "credit-note-modern",
    type: "creditNote",
    name: "Modern Credit Note",
    kind: "itemized",
    description: "Accent band header for returns and discounts.",
    layout: { headerStyle: "banner", fontPair: "sans", showLogo: true },
    premium: true,
  },
  {
    id: "debit-note-classic",
    type: "debitNote",
    name: "Classic Debit Note",
    kind: "itemized",
    description: "Formal additional-charge note on your letterhead.",
    layout: { headerStyle: "left", fontPair: "mixed", showLogo: true },
  },
];

export function templatesForType(type: DocumentType): TemplateDef[] {
  return TEMPLATES.filter((t) => t.type === type);
}

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const DOCUMENT_TYPES: DocumentType[] = [
  "quote",
  "invoice",
  "request",
  "receipt",
  "letter",
  "creditNote",
  "debitNote",
];

export function isItemized(type: DocumentType, templateId: string): boolean {
  return templateById(templateId)?.kind === "itemized" && type !== "letter";
}

/** Filename / heading label for a document, e.g. "Payment Request" */
export function documentLabel(type: DocumentType, templateId: string): string {
  // §16: the proforma is a template, not its own DocumentType — it keeps the
  // invoice number sequence but is titled as a proforma.
  if (type === "invoice" && templateId === "invoice-proforma") {
    return "Proforma Invoice";
  }
  if (type === "request") {
    return templateById(templateId)?.kind === "itemized"
      ? "Payment Request"
      : "Request Letter";
  }
  return TYPE_META[type].label;
}

export function defaultLayoutForType(type: DocumentType): TemplateLayout {
  const t = templatesForType(type)[0];
  return { ...t?.layout };
}

export function fontFamilyTokens(fontPair: FontPair = "mixed") {
  switch (fontPair) {
    case "sans":
      return { body: "Helvetica", display: "Helvetica-Bold", italic: "Helvetica-Oblique" };
    case "serif":
      return { body: "Times-Roman", display: "Times-Bold", italic: "Times-Italic" };
    default:
      return { body: "Helvetica", display: "Times-Bold", italic: "Times-Italic" };
  }
}

export type { HeaderStyle };
