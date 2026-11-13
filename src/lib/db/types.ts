import type { ObjectId } from "mongodb";

/* ============================================================
   Letterpad domain types (MongoDB documents)
   ============================================================ */

export type DocumentType =
  | "letter"
  | "quote"
  | "invoice"
  | "receipt"
  | "request"
  | "creditNote"
  | "debitNote";

export type PaymentMethod =
  | "cash"
  | "bank"
  | "upi"
  | "card"
  | "cheque"
  | "online"
  | "other";

export type ExpenseCategory =
  | "software"
  | "supplies"
  | "travel"
  | "marketing"
  | "rent"
  | "utilities"
  | "professional"
  | "equipment"
  | "other";

/** A payment recorded against an invoice (or payment request). */
export interface Payment {
  _id: ObjectId;
  workspaceId: ObjectId;
  documentId: ObjectId;
  /** Positive amount in document currency */
  amount: number;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  /** Refunds stay on the ledger but no longer count toward the balance */
  refunded: boolean;
  createdAt: Date;
}

/** A business expense (optionally with an uploaded receipt image). */
export interface Expense {
  _id: ObjectId;
  workspaceId: ObjectId;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  category: ExpenseCategory;
  vendor?: string;
  description: string;
  /** Net amount, tax excluded */
  amount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  /** Data-URI receipt image (png/jpeg), validated ≤ 700KB */
  receipt?: string;
  notes?: string;
  createdAt: Date;
}

/* ============================================================
   Phase 4 — products & services, projects, teams
   ============================================================ */

export type ProductKind = "product" | "service";

/** A catalogue item reusable on invoices and quotations. */
export interface Product {
  _id: ObjectId;
  workspaceId: ObjectId;
  kind: ProductKind;
  name: string;
  description?: string;
  /** SKU / service code */
  sku?: string;
  /** Price per unit in the workspace currency */
  unitPrice: number;
  /** Unit of measurement (hr, pcs, day, month, …) */
  unit?: string;
  /** Tax percentage applied when added to a document */
  taxRate: number;
  category?: string;
  /** Data-URI product image (png/jpeg), validated ≤ 700KB */
  image?: string;
  /** Inactive items stay in the catalogue but are hidden from pickers */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = "planned" | "active" | "on_hold" | "completed" | "cancelled";

export interface ProjectMilestone {
  id: string;
  title: string;
  /** ISO date "YYYY-MM-DD" */
  dueDate?: string;
  done: boolean;
  doneAt?: Date;
}

/** A client project grouping milestones and linked documents. */
export interface Project {
  _id: ObjectId;
  workspaceId: ObjectId;
  contactId: ObjectId | null;
  name: string;
  description?: string;
  status: ProjectStatus;
  /** ISO date "YYYY-MM-DD" */
  startDate?: string;
  /** ISO date "YYYY-MM-DD" */
  endDate?: string;
  milestones: ProjectMilestone[];
  /** Document ids associated with this project */
  documentIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export type WorkspaceRole = "owner" | "admin" | "member";

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  addedAt: Date;
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

/** An invitation to join a workspace as admin or member. */
export interface WorkspaceInvite {
  _id: ObjectId;
  workspaceId: ObjectId;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  token: string;
  invitedBy: string;
  invitedByName: string;
  status: InviteStatus;
  /** ISO datetime string */
  expiresAt: string;
  acceptedAt?: Date;
  createdAt: Date;
}

/** GST tax split stored on a document when the workspace has GST enabled. */
export interface GstSplit {
  placeOfSupply: string;
  cgst: number;
  sgst: number;
  igst: number;
}

export type DocumentStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "accepted"
  | "rejected"
  | "expired"
  | "overdue"
  | "void";

export type ActivityType =
  | "created"
  | "updated"
  | "status"
  | "shared"
  | "viewed"
  | "emailed"
  | "duplicated"
  | "trashed"
  | "restored"
  | "payment"
  | "signed"
  | "reminder";

/** How a client produced their signature (never represented as a verified e-signature). */
export type SignatureMethod = "drawn" | "typed" | "uploaded";

export interface DocSignature {
  signedBy: string;
  method: SignatureMethod;
  /** Data-URI PNG/JPEG for drawn or uploaded signatures */
  image?: string;
  /** Typed signature text (rendered in italics on the PDF) */
  text?: string;
  signedAt: Date;
  ip?: string;
}

export interface Discount {
  type: "percent" | "amount";
  value: number;
}

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

export type PlanId = "free" | "starter" | "professional" | "business";

export type SubscriptionStatus = "active" | "past_due" | "cancelled";

/** §20 — a workspace's subscription to a Letterpad plan. */
export interface WorkspaceSubscription {
  plan: PlanId;
  status: SubscriptionStatus;
  /** ISO date the paid period ends (kept after expiry for display) */
  currentPeriodEnd?: string;
  provider?: "razorpay" | "manual";
  /** Razorpay order id or admin note */
  referenceId?: string;
  startedAt: Date;
  updatedAt: Date;
}

/** Outbound webhook (§ third-party integrations) with HMAC signing secret. */
export interface WebhookConfig {
  url: string;
  secret: string;
  enabled: boolean;
  createdAt: Date;
}

/** International tax label/country (India GST uses gstEnabled instead). */
export interface TaxConfig {
  /** Display label on totals, e.g. "VAT", "GST", "Sales Tax" */
  label?: string;
  country?: string;
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
  pan?: string;
  upiId?: string;
  paymentInstructions?: string;
  bankDetails?: string;
  /** Split tax into CGST/SGST (intra-state) or IGST on documents */
  gstEnabled?: boolean;
  /** State used as the place of supply for GST (defaults to `state`) */
  placeOfSupply?: string;
  /** Razorpay Checkout key id (secret falls back to RAZORPAY_KEY_SECRET env) */
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  currency: string;
  taxRate: number;
  /** Primary brand colour — always equals brandColors[0] when present */
  brandColor: string;
  /** Full brand palette (1–6 hex colours); first is primary */
  brandColors?: string[];
  /** Custom document-number prefixes per type (e.g. invoice → "ACME") */
  numberPrefixes?: Partial<Record<DocumentType, string>>;
  /** Zero-pad width for the numeric segment (default 4 → 0001) */
  numberPad?: number;
  /** First sequence number when a counter is created (default 1) */
  numberStarts?: Partial<Record<DocumentType, number>>;
  /** Team members (the owner is `ownerUserId` and is not listed here) */
  members?: WorkspaceMember[];
  /** Cron-driven overdue reminders (default true when unset) */
  autoRemindersEnabled?: boolean;
  /** §20 subscription (absent = free plan) */
  subscription?: WorkspaceSubscription;
  /** Hide "Powered by Letterpad" on portal/share pages (plan-gated) */
  whiteLabel?: boolean;
  /** International tax display (label + country) */
  taxConfig?: TaxConfig;
  /** Outbound webhook for document events */
  webhook?: WebhookConfig;
  /** Public API key (`lpk_…`) for /api/v1 */
  apiKey?: string;
  /** Razorpay order awaiting plan checkout confirmation */
  pendingPlanOrder?: string;
  pendingPlan?: PlanId;
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
  taxId?: string;
  archived: boolean;
  /** Opaque client-portal token when sharing a contact folder */
  portalToken?: string;
  portalEnabled?: boolean;
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
  /** Project this document belongs to (set from the Projects page) */
  projectId?: ObjectId | null;
  /** ISO date "YYYY-MM-DD" */
  issueDate: string;
  dueDate?: string;
  currency: string;
  items: DocumentItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  discount?: Discount;
  /** Original invoice number this credit/debit note adjusts */
  referenceNumber?: string;
  /** GST split captured at save time when the workspace has GST enabled */
  gst?: GstSplit;
  /** Pending Razorpay order id waiting for payment confirmation */
  razorpayOrderId?: string;
  /** Set when the business asks the client to sign this document */
  signatureRequested?: boolean;
  /** Client signature captured through the portal */
  signature?: DocSignature;
  /** Invoice this document was converted from (quotation → invoice workflow) */
  convertedFromId?: ObjectId;
  /** Last time the cron sent an automatic payment reminder for this doc */
  autoReminderAt?: Date;
  /** How many automatic payment reminders cron has sent for this doc */
  autoReminderCount?: number;
  content: DocumentContent;
  layout: TemplateLayout;
  createdBy: string;
  /** Soft-delete timestamp; null/absent = live */
  deletedAt?: Date | null;
  /** Opaque public share token when sharing is enabled */
  shareToken?: string;
  shareEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityEvent {
  _id: ObjectId;
  workspaceId: ObjectId;
  documentId: ObjectId;
  type: ActivityType;
  message: string;
  /** User id, or "system" / "client" for external actors */
  actor: string;
  createdAt: Date;
}

export interface Counter {
  _id: string; // `${workspaceId}:${type}`
  seq: number;
}

export type RecurrenceInterval =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "yearly";

export type ScheduleStatus = "active" | "paused" | "completed";

/* ============================================================
   Phase 5 — scheduled document delivery
   ============================================================ */

export type DeliveryStatus = "pending" | "sent" | "failed" | "cancelled";

/** A document queued to be emailed at a future time (cron delivery). */
export interface ScheduledDelivery {
  _id: ObjectId;
  workspaceId: ObjectId;
  documentId: ObjectId;
  /** ISO datetime string (UTC) when the email should go out */
  sendAt: string;
  to: string;
  subject?: string;
  message?: string;
  status: DeliveryStatus;
  sentAt?: Date;
  error?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A recurring document generator (typically invoices/quotes). */
export interface RecurringSchedule {
  _id: ObjectId;
  workspaceId: ObjectId;
  contactId: ObjectId | null;
  type: DocumentType;
  templateId: string;
  title?: string;
  interval: RecurrenceInterval;
  status: ScheduleStatus;
  /** ISO date the schedule was created / first period starts */
  startDate: string;
  /** Optional ISO end date — no runs after this day */
  endDate?: string;
  /** ISO date of the next planned run */
  nextRunAt: string;
  lastRunAt?: string;
  lastDocumentId?: ObjectId;
  runCount: number;
  currency: string;
  items: DocumentItem[];
  discount?: Discount;
  content: DocumentContent;
  layout: TemplateLayout;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
