import { NUMBER_PREFIX, padNumber, todayIsoDate } from "@/lib/utils";
import type {
  DocumentType,
  RecurrenceInterval,
  Workspace,
} from "@/lib/db/types";

export const INTERVAL_LABELS: Record<RecurrenceInterval, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  quarterly: "Every quarter",
  yearly: "Every year",
};

export const RECURRENCE_INTERVALS: RecurrenceInterval[] = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
];

/** Format a local Date as YYYY-MM-DD (avoids UTC day-shift from toISOString). */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last day of the month for (year, 0-based month). */
function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Advance an ISO date by one interval (calendar-aware for month/year). */
export function addInterval(isoDate: string, interval: RecurrenceInterval): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  switch (interval) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
      break;
    case "quarterly": {
      d.setDate(1);
      d.setMonth(d.getMonth() + 3);
      d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
      break;
    }
    case "yearly": {
      d.setDate(1);
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
      break;
    }
  }
  return toIsoDate(d);
}

/** A schedule is due when nextRunAt is on or before today. */
export function isDue(nextRunAt: string, today = todayIsoDate()): boolean {
  if (!nextRunAt) return false;
  return nextRunAt <= today;
}

/** True when the schedule has passed its optional end date. */
export function isPastEnd(endDate: string | undefined, today = todayIsoDate()): boolean {
  if (!endDate) return false;
  return endDate < today;
}

export function intervalLabel(interval: RecurrenceInterval): string {
  return INTERVAL_LABELS[interval] ?? interval;
}

export interface NumberingConfig {
  prefix?: string;
  pad?: number;
  start?: number;
}

/** Resolve numbering overrides from workspace settings (falls back to defaults). */
export function numberingConfig(
  workspace: Pick<Workspace, "numberPrefixes" | "numberPad" | "numberStarts">,
  type: DocumentType,
): NumberingConfig {
  return {
    prefix: workspace.numberPrefixes?.[type] || NUMBER_PREFIX[type],
    pad: workspace.numberPad ?? 4,
    start: workspace.numberStarts?.[type] ?? 1,
  };
}

/** Format a sequence with the resolved prefix + pad (pure — used by counters). */
export function formatDocumentNumber(
  type: DocumentType,
  seq: number,
  config?: NumberingConfig,
): string {
  const prefix = config?.prefix || NUMBER_PREFIX[type];
  const pad = config?.pad && config.pad > 0 ? config.pad : 4;
  return `${prefix}-${padNumber(seq, pad)}`;
}
