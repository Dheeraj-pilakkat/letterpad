/**
 * Phase 6 — §20 plans, limits and feature gates (pure).
 *
 * The plan matrix is enforced only where it adds value without breaking
 * already-shipped features: monthly document quota, premium templates,
 * AI, white-label, outbound webhooks and team seats. Everything else is
 * advertised on the billing page but left open for existing workspaces.
 */

import type { PlanId, Workspace } from "@/lib/db/types";

export const PLAN_IDS = ["free", "starter", "professional", "business"] as const;

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  business: 3,
};

export interface PlanDef {
  id: PlanId;
  name: string;
  /** INR per month (₹0 for free) — indicative §20 pricing */
  priceInr: number;
  priceLabel: string;
  blurb: string;
  /** Documents creatable per calendar month; null = unlimited */
  documentsPerMonth: number | null;
  /** Members besides the owner (fair-use cap) */
  teamSeats: number;
  premiumTemplates: boolean;
  whiteLabel: boolean;
  ai: boolean;
  /** Outbound webhooks for document events */
  webhooks: boolean;
  /** Outbound requests per minute for the public API */
  apiRatePerMin: number;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    priceInr: 0,
    priceLabel: "₹0",
    blurb: "For beginners and occasional invoicing.",
    documentsPerMonth: 5,
    teamSeats: 3,
    premiumTemplates: false,
    whiteLabel: false,
    ai: false,
    webhooks: false,
    apiRatePerMin: 30,
    features: [
      "5 documents / month",
      "Basic templates",
      "PDF export & sharing",
      "Client portal & payment tracking",
      "Public API (rate limited)",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceInr: 249,
    priceLabel: "₹249/mo",
    blurb: "For active freelancers who invoice every week.",
    documentsPerMonth: 100,
    teamSeats: 3,
    premiumTemplates: true,
    whiteLabel: false,
    ai: false,
    webhooks: true,
    apiRatePerMin: 120,
    features: [
      "100 documents / month",
      "Premium templates",
      "Unlimited clients",
      "Payment tracking & email sharing",
      "Outbound webhooks",
    ],
  },
  professional: {
    id: "professional",
    name: "Professional",
    priceInr: 599,
    priceLabel: "₹599/mo",
    blurb: "For professionals and small agencies.",
    documentsPerMonth: null,
    teamSeats: 5,
    premiumTemplates: true,
    whiteLabel: false,
    ai: true,
    webhooks: true,
    apiRatePerMin: 240,
    features: [
      "Unlimited documents",
      "Everything in Starter",
      "AI writing assistant",
      "Recurring invoices & advanced reports",
      "Digital approvals & payment gateway",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    priceInr: 1299,
    priceLabel: "₹1,299/mo",
    blurb: "For small companies with a team behind them.",
    documentsPerMonth: null,
    teamSeats: 25,
    premiumTemplates: true,
    whiteLabel: true,
    ai: true,
    webhooks: true,
    apiRatePerMin: 240,
    features: [
      "Unlimited documents",
      "Everything in Professional",
      "White-label branding (no Letterpad footer)",
      "Up to 25 team seats",
      "Priority support",
    ],
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function planAtLeast(plan: PlanId, min: PlanId): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[min];
}

/**
 * The plan a workspace is on today: absent, cancelled or an expired
 * paid period all fall back to free.
 */
export function currentPlanId(
  workspace: Pick<Workspace, "subscription">,
  today: string = new Date().toISOString().slice(0, 10),
): PlanId {
  const sub = workspace.subscription;
  if (!sub || sub.status === "cancelled") return "free";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < today) return "free";
  return isPlanId(sub.plan) ? sub.plan : "free";
}

export function planDef(workspace: Pick<Workspace, "subscription">): PlanDef {
  return PLANS[currentPlanId(workspace)];
}

export type PlanFeature = "premiumTemplates" | "whiteLabel" | "ai" | "webhooks";

export function hasPlanFeature(
  workspace: Pick<Workspace, "subscription">,
  feature: PlanFeature,
): boolean {
  return planDef(workspace)[feature];
}

/** null = unlimited */
export function documentLimit(
  workspace: Pick<Workspace, "subscription">,
): number | null {
  return planDef(workspace).documentsPerMonth;
}

export function checkDocumentQuota(
  workspace: Pick<Workspace, "subscription">,
  createdThisMonth: number,
): { ok: boolean; error?: string } {
  const limit = documentLimit(workspace);
  if (limit === null || createdThisMonth < limit) return { ok: true };
  const plan = planDef(workspace);
  return {
    ok: false,
    error: `${plan.name} plan allows ${limit} documents per month. Upgrade to create more.`,
  };
}

export function checkTemplateAccess(
  workspace: Pick<Workspace, "subscription">,
  template: { premium?: boolean },
): { ok: boolean; error?: string } {
  if (!template.premium || hasPlanFeature(workspace, "premiumTemplates")) {
    return { ok: true };
  }
  const plan = planDef(workspace);
  return {
    ok: false,
    error: `Premium templates need the Starter plan or higher (you're on ${plan.name}).`,
  };
}

/** `memberCount` = members already in the workspace (owner excluded). */
export function checkSeatLimit(
  workspace: Pick<Workspace, "subscription">,
  memberCount: number,
): { ok: boolean; error?: string } {
  const seats = planDef(workspace).teamSeats;
  if (memberCount < seats) return { ok: true };
  return {
    ok: false,
    error: `Your ${planDef(workspace).name} plan allows ${seats} team members. Upgrade for more seats.`,
  };
}

export function checkAiAccess(
  workspace: Pick<Workspace, "subscription">,
): { ok: boolean; error?: string } {
  if (hasPlanFeature(workspace, "ai")) return { ok: true };
  return {
    ok: false,
    error: "The AI assistant is included in the Professional plan and above.",
  };
}

export function apiRateLimitFor(
  workspace: Pick<Workspace, "subscription">,
): number {
  return planDef(workspace).apiRatePerMin;
}
