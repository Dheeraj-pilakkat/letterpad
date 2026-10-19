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
    id: "request-letter",
    type: "request",
    name: "Formal Request Letter",
    kind: "prose",
    description: "A formal letter for requests, approvals or documents.",
    layout: { headerStyle: "left", fontPair: "serif", showLogo: true, showSignature: true },
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
  },
  {
    id: "letter-minimal",
    type: "letter",
    name: "Minimal Letter",
    kind: "prose",
    description: "Centred, serif, no logo — pure typography.",
    layout: { headerStyle: "center", fontPair: "serif", showSignature: true },
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
];

export function isItemized(type: DocumentType, templateId: string): boolean {
  return templateById(templateId)?.kind === "itemized" && type !== "letter";
}

/** Filename / heading label for a document, e.g. "Payment Request" */
export function documentLabel(type: DocumentType, templateId: string): string {
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
