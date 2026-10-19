import type { ObjectId } from "mongodb";

/* ============================================================
   Letterpad domain types (MongoDB documents)
   ============================================================ */

export type DocumentType =
  | "letter"
  | "quote"
  | "invoice"
  | "receipt"
  | "request";

export type DocumentStatus =
  | "draft"
  | "sent"
  | "paid"
  | "accepted"
  | "void";

export type TemplateKind = "itemized" | "prose";
export type HeaderStyle = "left" | "center" | "banner";
export type FontPair = "sans" | "serif" | "mixed";

/** Snapshot of letterhead styling — stored on each document so old files never restyle. */
export interface LineItemColumns {
  qty?: boolean;
  unitPrice?: boolean;
  tax?: boolean;
}

export interface TemplateLayout {
  accentColor?: string;
  fontPair?: FontPair;
  showLogo?: boolean;
  showSignature?: boolean;
  headerStyle?: HeaderStyle;
  columns?: LineItemColumns;
  /** User-defined extra columns for the itemized table */
  customColumns?: CustomColumn[];
}

export interface Workspace {
  _id: ObjectId;
  name: string;
  slug: string;
  ownerUserId: string;
  /** Data-URI image (png/jpeg), validated ≤ 700KB */
  logo?: string;
  signature?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  bankDetails?: string;
  currency: string;
  taxRate: number;
  /** Primary brand colour — always equals brandColors[0] when present */
  brandColor: string;
  /** Full brand palette (1–6 hex colours); first is primary */
  brandColors?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  _id: ObjectId;
  workspaceId: ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  /** Net line total (qty × unit price), tax excluded */
  amount: number;
  /** User-defined custom column values, keyed by CustomColumn.id */
  values?: Record<string, string>;
}

/** A user-defined column on the line-item table (e.g. "Discount", "SLA") */
export interface CustomColumn {
  id: string;
  label: string;
  type: "text" | "number";
}

export interface DocumentContent {
  subject?: string;
  body?: string;
  terms?: string;
}

export interface LetterpadDoc {
  _id: ObjectId;
  workspaceId: ObjectId;
  type: DocumentType;
  templateId: string;
  number: string;
  status: DocumentStatus;
  title?: string;
  contactId: ObjectId | null;
  /** ISO date "YYYY-MM-DD" */
  issueDate: string;
  dueDate?: string;
  currency: string;
  items: DocumentItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  content: DocumentContent;
  layout: TemplateLayout;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Counter {
  _id: string; // `${workspaceId}:${type}`
  seq: number;
}
