import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { overlayBranding } from "@/lib/branding";
import { counterKey } from "@/lib/counters";
import type { BusinessProfile, Workspace } from "@/lib/db/types";

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    _id: new ObjectId(),
    name: "Acme Pvt Ltd",
    slug: "acme",
    ownerUserId: "user1",
    currency: "USD",
    taxRate: 0,
    brandColor: "#B4552D",
    brandColors: ["#B4552D", "#111111"],
    logo: "data:image/png;base64,ws",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    gstEnabled: false,
    numberPad: 4,
    numberPrefixes: { invoice: "ACME" },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  const now = new Date("2026-02-01T00:00:00Z");
  return {
    _id: new ObjectId(),
    workspaceId: new ObjectId(),
    name: "Acme US Inc",
    currency: "EUR",
    taxRate: 20,
    brandColor: "#0B3D91",
    createdBy: "user1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("overlayBranding (§6)", () => {
  it("returns the workspace untouched when no profile is active", () => {
    const ws = makeWorkspace();
    expect(overlayBranding(ws)).toBe(ws);
    expect(overlayBranding(ws, null)).toBe(ws);
  });

  it("profile identity fields win over the workspace", () => {
    const ws = makeWorkspace();
    const profile = makeProfile({
      logo: "data:image/png;base64,profile",
      city: "Berlin",
      country: "Germany",
      gstEnabled: true,
      brandColors: ["#0B3D91"],
    });
    const merged = overlayBranding(ws, profile);

    expect(merged.name).toBe("Acme US Inc");
    expect(merged.logo).toBe("data:image/png;base64,profile");
    expect(merged.city).toBe("Berlin");
    expect(merged.country).toBe("Germany");
    expect(merged.gstEnabled).toBe(true);
    expect(merged.currency).toBe("EUR");
    expect(merged.taxRate).toBe(20);
    expect(merged.brandColor).toBe("#0B3D91");
    expect(merged.brandColors).toEqual(["#0B3D91"]);
  });

  it("unset profile fields fall back to the workspace letterhead", () => {
    const ws = makeWorkspace();
    const profile = makeProfile(); // only name/currency/tax/brand set
    const merged = overlayBranding(ws, profile);

    expect(merged.logo).toBe("data:image/png;base64,ws");
    expect(merged.city).toBe("Mumbai");
    expect(merged.state).toBe("Maharashtra");
    expect(merged.gstEnabled).toBe(false);
    expect(merged.numberPrefixes).toEqual({ invoice: "ACME" });
    expect(merged.numberPad).toBe(4);
    expect(merged.brandColors).toEqual(["#B4552D", "#111111"]);
  });

  it("does not mutate the workspace or the profile", () => {
    const ws = makeWorkspace();
    const profile = makeProfile({ city: "Berlin" });
    overlayBranding(ws, profile);
    expect(ws.city).toBe("Mumbai");
    expect(profile.city).toBe("Berlin");
  });
});

describe("counterKey (§6 separate numbering)", () => {
  it("stays workspace-scoped without a profile", () => {
    expect(counterKey("ws1", "invoice")).toBe("ws1:invoice");
    expect(counterKey("ws1", "invoice", null)).toBe("ws1:invoice");
  });

  it("scopes the sequence to the profile when one is active", () => {
    expect(counterKey("ws1", "invoice", "prof1")).toBe("ws1:prof1:invoice");
    expect(counterKey("ws1", "quote", "prof1")).toBe("ws1:prof1:quote");
  });

  it("profiles share no numbers with the default sequence", () => {
    expect(counterKey("ws1", "invoice", "prof1")).not.toBe(
      counterKey("ws1", "invoice"),
    );
    expect(counterKey("ws1", "invoice", "prof1")).not.toBe(
      counterKey("ws1", "invoice", "prof2"),
    );
  });
});
