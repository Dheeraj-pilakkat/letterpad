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
  bankDetails: z.string().trim().max(1200).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED", "SGD"]),
  taxRate: z.coerce.number().min(0).max(100),
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
  currency: z.enum(["USD", "EUR", "GBP", "INR", "AUD", "CAD", "AED", "SGD"]),
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
});

export type DocumentInput = z.infer<typeof documentSchema>;

/* ============================================================
   Money math — single source of truth for totals.
   ============================================================ */

export function lineAmount(item: Pick<DocumentItem, "quantity" | "unitPrice">) {
  return round2(item.quantity * item.unitPrice);
}

export function computeTotals(
  items: Array<Pick<DocumentItem, "quantity" | "unitPrice" | "taxRate">>,
) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const net = lineAmount(item);
    subtotal += net;
    taxTotal += round2((net * item.taxRate) / 100);
  }
  subtotal = round2(subtotal);
  taxTotal = round2(taxTotal);
  return { subtotal, taxTotal, total: round2(subtotal + taxTotal) };
}
