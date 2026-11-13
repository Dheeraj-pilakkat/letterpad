import { describe, expect, it } from "vitest";
import {
  PLANS,
  PLAN_IDS,
  apiRateLimitFor,
  checkAiAccess,
  checkDocumentQuota,
  checkSeatLimit,
  checkTemplateAccess,
  currentPlanId,
  documentLimit,
  hasPlanFeature,
  isPlanId,
  planAtLeast,
  planDef,
} from "@/lib/plans";
import { TEMPLATES, templatesForType } from "@/lib/templates/registry";
import type { PlanId, Workspace } from "@/lib/db/types";

function ws(subscription?: Workspace["subscription"]): Workspace {
  return {
    _id: {} as Workspace["_id"],
    name: "Acme",
    slug: "acme",
    ownerUserId: "u1",
    currency: "INR",
    taxRate: 18,
    brandColor: "#1C2536",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(subscription ? { subscription } : {}),
  };
}

function sub(plan: PlanId, overrides: Partial<NonNullable<Workspace["subscription"]>> = {}) {
  return {
    plan,
    status: "active" as const,
    startedAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("currentPlanId", () => {
  it("defaults to free without a subscription", () => {
    expect(currentPlanId(ws())).toBe("free");
  });

  it("returns the active plan", () => {
    expect(currentPlanId(ws(sub("professional")))).toBe("professional");
  });

  it("falls back to free after the paid period ends", () => {
    expect(
      currentPlanId(ws(sub("business", { currentPeriodEnd: "2026-01-31" })), "2026-02-01"),
    ).toBe("free");
    expect(
      currentPlanId(ws(sub("business", { currentPeriodEnd: "2026-01-31" })), "2026-01-31"),
    ).toBe("business");
  });

  it("falls back to free when cancelled", () => {
    expect(currentPlanId(ws(sub("starter", { status: "cancelled" })))).toBe("free");
  });

  it("keeps a past-due plan until the period ends", () => {
    expect(
      currentPlanId(ws(sub("starter", { status: "past_due", currentPeriodEnd: "2026-06-01" })), "2026-05-01"),
    ).toBe("starter");
  });

  it("rejects unknown plan ids", () => {
    expect(currentPlanId(ws(sub("enterprise" as PlanId)))).toBe("free");
  });
});

describe("plan helpers", () => {
  it("isPlanId validates against known ids", () => {
    expect(isPlanId("free")).toBe(true);
    expect(isPlanId("enterprise")).toBe(false);
    expect(isPlanId(42)).toBe(false);
  });

  it("planAtLeast orders free < starter < professional < business", () => {
    expect(planAtLeast("business", "professional")).toBe(true);
    expect(planAtLeast("starter", "professional")).toBe(false);
    expect(planAtLeast("free", "free")).toBe(true);
  });

  it("planDef resolves the current plan definition", () => {
    expect(planDef(ws(sub("starter"))).name).toBe("Starter");
    expect(planDef(ws()).name).toBe("Free");
  });

  it("every plan id has a definition", () => {
    for (const id of PLAN_IDS) expect(PLANS[id].id).toBe(id);
  });
});

describe("feature gates", () => {
  it("premium templates need starter or higher", () => {
    expect(hasPlanFeature(ws(), "premiumTemplates")).toBe(false);
    expect(hasPlanFeature(ws(sub("starter")), "premiumTemplates")).toBe(true);
  });

  it("white-label needs the business plan", () => {
    expect(hasPlanFeature(ws(sub("professional")), "whiteLabel")).toBe(false);
    expect(hasPlanFeature(ws(sub("business")), "whiteLabel")).toBe(true);
  });

  it("ai needs professional or higher", () => {
    expect(hasPlanFeature(ws(sub("starter")), "ai")).toBe(false);
    expect(hasPlanFeature(ws(sub("professional")), "ai")).toBe(true);
    expect(checkAiAccess(ws()).ok).toBe(false);
    expect(checkAiAccess(ws(sub("professional"))).ok).toBe(true);
  });

  it("webhooks need starter or higher", () => {
    expect(hasPlanFeature(ws(), "webhooks")).toBe(false);
    expect(hasPlanFeature(ws(sub("starter")), "webhooks")).toBe(true);
  });

  it("api rate limits grow with the plan", () => {
    expect(apiRateLimitFor(ws())).toBe(30);
    expect(apiRateLimitFor(ws(sub("starter")))).toBe(120);
    expect(apiRateLimitFor(ws(sub("business")))).toBe(240);
  });
});

describe("checkDocumentQuota", () => {
  it("free plan caps at 5 per month", () => {
    expect(checkDocumentQuota(ws(), 4).ok).toBe(true);
    expect(checkDocumentQuota(ws(), 5).ok).toBe(false);
    expect(checkDocumentQuota(ws(), 5).error).toContain("Free plan");
  });

  it("starter caps at 100", () => {
    expect(checkDocumentQuota(ws(sub("starter")), 99).ok).toBe(true);
    expect(checkDocumentQuota(ws(sub("starter")), 100).ok).toBe(false);
  });

  it("professional and business are unlimited", () => {
    expect(documentLimit(ws(sub("professional")))).toBeNull();
    expect(checkDocumentQuota(ws(sub("professional")), 10_000).ok).toBe(true);
    expect(checkDocumentQuota(ws(sub("business")), 10_000).ok).toBe(true);
  });
});

describe("checkTemplateAccess", () => {
  it("basic templates are always allowed", () => {
    expect(checkTemplateAccess(ws(), { premium: undefined }).ok).toBe(true);
    expect(checkTemplateAccess(ws(), {}).ok).toBe(true);
  });

  it("premium templates need starter+", () => {
    expect(checkTemplateAccess(ws(), { premium: true }).ok).toBe(false);
    expect(checkTemplateAccess(ws(sub("starter")), { premium: true }).ok).toBe(true);
  });

  it("registry keeps one free template per document type", () => {
    const types = new Set(TEMPLATES.map((t) => t.type));
    for (const type of types) {
      const free = templatesForType(type).filter((t) => !t.premium);
      expect(free.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("registry marks a sensible number of premium templates", () => {
    const premium = TEMPLATES.filter((t) => t.premium);
    expect(premium.length).toBeGreaterThanOrEqual(6);
    expect(premium.length).toBeLessThan(TEMPLATES.length);
  });
});

describe("checkSeatLimit", () => {
  it("free allows up to 3 members", () => {
    expect(checkSeatLimit(ws(), 2).ok).toBe(true);
    expect(checkSeatLimit(ws(), 3).ok).toBe(false);
  });

  it("business allows 25", () => {
    expect(checkSeatLimit(ws(sub("business")), 24).ok).toBe(true);
    expect(checkSeatLimit(ws(sub("business")), 25).ok).toBe(false);
  });
});
