import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { DocumentType } from "@/lib/db/types";

/** Document-number prefixes, e.g. `QTN-0001`. Pure data — safe for client bundles. */
export const NUMBER_PREFIX: Record<DocumentType, string> = {
  letter: "LTR",
  quote: "QTN",
  invoice: "INV",
  receipt: "RCT",
  request: "REQ",
  creditNote: "CRN",
  debitNote: "DBN",
};

/** BCP-47 locale used for currency formatting per ISO code. */
export const CURRENCY_LOCALES: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  AUD: "en-AU",
  CAD: "en-CA",
  AED: "en-AE",
  SGD: "en-SG",
};

export function currencyLocale(currency: string): string {
  return CURRENCY_LOCALES[currency] ?? "en-US";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Round to 2 decimals without floating point drift (money safe for our scale). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Format a money amount with the document currency + locale conventions. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currencyLocale(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${round2(amount).toFixed(2)}`;
  }
}

/** "2026-10-16" -> "16 Oct 2026" */
export function formatDate(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function padNumber(value: number, width = 4): string {
  return String(value).padStart(width, "0");
}
