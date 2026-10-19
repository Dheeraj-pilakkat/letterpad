import type { DocumentStatus } from "@/lib/db/types";

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "AUD",
  "CAD",
  "AED",
  "SGD",
] as const;

export const BRAND_COLORS = [
  "#B4552D", // copper
  "#1C2536", // ink
  "#2F5D50", // forest
  "#7A3E65", // plum
  "#1F4E79", // navy
  "#8A5A12", // amber-ink
] as const;

/** Legal document status transitions, guarded in updateDocumentStatusAction. */
export const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "accepted", "void", "draft"],
  paid: ["void"],
  accepted: ["void"],
  void: ["draft"],
};
