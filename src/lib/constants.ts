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
  "JPY",
  "CHF",
  "NZD",
  "SAR",
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
  sent: ["viewed", "paid", "accepted", "rejected", "overdue", "expired", "void", "draft"],
  viewed: ["paid", "accepted", "rejected", "overdue", "expired", "void", "draft"],
  paid: ["void"],
  accepted: ["void"],
  rejected: ["draft", "void"],
  expired: ["draft", "void"],
  overdue: ["paid", "void", "draft"],
  void: ["draft"],
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  overdue: "Overdue",
  void: "Void",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Edited",
  status: "Status changed",
  shared: "Shared",
  viewed: "Viewed",
  emailed: "Emailed",
  duplicated: "Duplicated",
  trashed: "Moved to trash",
  restored: "Restored",
  payment: "Payment",
  signed: "Signed",
  reminder: "Reminder",
};
