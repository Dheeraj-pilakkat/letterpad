import { z } from "zod";
import type { DocumentItem } from "@/lib/db/types";
import { round2 } from "@/lib/utils";

const imageSchema = z
  .string()
  .refine(
    (v) =>
      v.startsWith("data:image/png;base64,") ||
      v.startsWith("data:image/jpeg;base64,"),
    { message: "Logo must be a PNG or JPEG image" },
  )
  .refine((v) => v.length <= 950_000, {
    message: "Image must be smaller than 700KB",
  });

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(120),
  logo: imageSchema.optional().or(z.literal("")),
  signature: imageSchema.optional().or(z.literal("")),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.email("Invalid email").or(z.literal("")).optional(),
  website: z.string().trim().max(160).optional(),
  taxId: z.string().trim().max(60).optional(),
  pan: z.string().trim().max(20).optional(),
  upiId: z.string().trim().max(80).optional(),
  paymentInstructions: z.string().trim().max(1200).optional(),
  bankDetails: z.string().trim().max(1200).optional(),
  gstEnabled: z.coerce.boolean().optional(),
  placeOfSupply: z.string().trim().max(100).optional(),
  razorpayKeyId: z.string().trim().max(100).optional(),
  razorpayKeySecret: z.string().trim().max(200).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED", "SGD", "JPY", "CHF", "NZD", "SAR"]),
  taxRate: z.coerce.number().min(0).max(100),
  /** Tax label printed on PDFs (GST / VAT / Sales Tax …) and its jurisdiction */
  taxLabel: z.string().trim().max(40).optional(),
  taxCountry: z.string().trim().max(64).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #B4552D"),
  brandColors: z
    .array(
      z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use hex colors like #B4552D"),
    )
    .min(1, "Pick at least one brand color")
    .max(6, "Up to 6 brand colors")
    .optional(),
  numberPrefixes: z
    .record(
      z.enum([
        "letter",
        "quote",
        "invoice",
        "receipt",
        "request",
        "creditNote",
        "debitNote",
      ]),
      z.string().trim().min(1).max(8),
    )
    .optional(),
  numberPad: z.coerce.number().int().min(1).max(8).optional(),
  numberStarts: z
    .record(
      z.enum([
        "letter",
        "quote",
        "invoice",
        "receipt",
        "request",
        "creditNote",
        "debitNote",
      ]),
      z.coerce.number().int().min(0).max(999_999),
    )
    .optional(),
});

export type WorkspaceInput = z.infer<typeof workspaceSchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  companyName: z.string().trim().max(160).optional(),
  email: z.email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(2000).optional(),
  taxId: z.string().trim().max(60).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const documentItemSchema = z.object({
  description: z.string().trim().min(1, "Description required").max(500),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
  taxRate: z.coerce.number().min(0).max(100),
  /** Custom column values keyed by CustomColumn.id */
  values: z.record(z.string().max(40), z.string().max(300)).optional(),
});

export const documentSchema = z.object({
  title: z.string().trim().max(200).optional(),
  templateId: z.string().min(1),
  contactId: z.string().regex(/^[0-9a-fA-F]{24}$/).or(z.literal("")),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal(""))
    .optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED", "SGD", "JPY", "CHF", "NZD", "SAR"]),
  content: z.object({
    subject: z.string().trim().max(300).optional(),
    body: z.string().max(20_000).optional(),
    terms: z.string().max(5_000).optional(),
  }),
  items: z.array(documentItemSchema).max(200).default([]),
  columns: z
    .object({
      qty: z.boolean().optional(),
      unitPrice: z.boolean().optional(),
      tax: z.boolean().optional(),
    })
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #B4552D")
    .optional(),
  customColumns: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1, "Column name required").max(40),
        type: z.enum(["text", "number"]),
      }),
    )
    .max(4, "Up to 4 custom columns")
    .optional(),
  discount: z
    .object({
      type: z.enum(["percent", "amount"]),
      value: z.coerce.number().min(0).max(1_000_000_000),
    })
    .optional(),
});

export type DocumentInput = z.infer<typeof documentSchema>;

/* ============================================================
   Finance — payments and expenses
   ============================================================ */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000_000),
  date: isoDate,
  method: z.enum(["cash", "bank", "upi", "card", "cheque", "online", "other"]),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseSchema = z.object({
  date: isoDate,
  category: z.enum([
    "software",
    "supplies",
    "travel",
    "marketing",
    "rent",
    "utilities",
    "professional",
    "equipment",
    "other",
  ]),
  vendor: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1, "Description is required").max(300),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000_000),
  taxRate: z.coerce.number().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
  receipt: z
    .string()
    .refine(
      (v) =>
        v.startsWith("data:image/png;base64,") ||
        v.startsWith("data:image/jpeg;base64,"),
      { message: "Receipt must be a PNG or JPEG image" },
    )
    .refine((v) => v.length <= 950_000, {
      message: "Receipt image must be smaller than 700KB",
    })
    .optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

/* ============================================================
   Phase 4 — catalogue & projects
   ============================================================ */

export const productSchema = z.object({
  kind: z.enum(["product", "service"]),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional(),
  sku: z.string().trim().max(40).optional(),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
  unit: z.string().trim().max(20).optional(),
  taxRate: z.coerce.number().min(0).max(100),
  category: z.string().trim().max(60).optional(),
  image: imageSchema.optional(),
  active: z.boolean(),
});

export type ProductInput = z.infer<typeof productSchema>;

const milestoneSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1, "Milestone title is required").max(120),
  dueDate: isoDate.optional(),
  done: z.boolean(),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  description: z.string().trim().max(1000).optional(),
  contactId: z.string().optional(),
  status: z.enum(["planned", "active", "on_hold", "completed", "cancelled"]),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  milestones: z.array(milestoneSchema).max(100).optional(),
});

export type ProjectInput = z.infer<typeof projectSchema>;

/* ============================================================
   Money math — single source of truth for totals.
   ============================================================ */

export function lineAmount(item: Pick<DocumentItem, "quantity" | "unitPrice">) {
  return round2(item.quantity * item.unitPrice);
}

/** Document-level discount against the pre-tax subtotal (clamped ≥ 0). */
export function computeDiscount(
  subtotal: number,
  discount?: { type: "percent" | "amount"; value: number } | null,
): number {
  if (!discount || discount.value <= 0 || subtotal <= 0) return 0;
  const raw =
    discount.type === "percent"
      ? (subtotal * discount.value) / 100
      : discount.value;
  return Math.min(round2(raw), subtotal);
}

export function computeTotals(
  items: Array<Pick<DocumentItem, "quantity" | "unitPrice" | "taxRate">>,
  discount?: { type: "percent" | "amount"; value: number } | null,
) {
  let subtotal = 0;
  let rawTax = 0;
  for (const item of items) {
    const net = lineAmount(item);
    subtotal += net;
    rawTax += round2((net * item.taxRate) / 100);
  }
  subtotal = round2(subtotal);
  rawTax = round2(rawTax);

  const discountTotal = computeDiscount(subtotal, discount);
  const netSubtotal = round2(subtotal - discountTotal);
  // Scale tax with the discounted base so tax never exceeds tax-on-gross.
  const taxTotal =
    subtotal > 0 && discountTotal > 0
      ? round2((rawTax * netSubtotal) / subtotal)
      : rawTax;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: round2(netSubtotal + taxTotal),
  };
}
