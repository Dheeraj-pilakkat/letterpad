import { describe, expect, it } from "vitest";
import {
  isExpired,
  portalExpiry,
  PORTAL_TTL_DAYS,
  shareExpiry,
  SHARE_TTL_DAYS,
} from "@/lib/share";

describe("expiring URL helpers (§22)", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  it("share links expire after 30 days", () => {
    expect(SHARE_TTL_DAYS).toBe(30);
    const at = shareExpiry(now);
    expect(at.getTime()).toBe(now.getTime() + 30 * 86_400_000);
    expect(isExpired(at, now)).toBe(false);
    expect(isExpired(at, new Date(at.getTime() + 1))).toBe(true);
  });

  it("portal links expire after 180 days", () => {
    expect(PORTAL_TTL_DAYS).toBe(180);
    const at = portalExpiry(now);
    expect(at.getTime()).toBe(now.getTime() + 180 * 86_400_000);
    expect(isExpired(at, now)).toBe(false);
  });

  it("treats missing, empty and invalid expiries as expired", () => {
    expect(isExpired(undefined, now)).toBe(true);
    expect(isExpired(null, now)).toBe(true);
    expect(isExpired("", now)).toBe(true);
    expect(isExpired("not-a-date", now)).toBe(true);
    expect(isExpired(new Date(now.getTime() + 60_000).toISOString(), now)).toBe(
      false,
    );
    expect(isExpired(new Date(now.getTime() + 60_000), now)).toBe(false);
    expect(isExpired(now, now)).toBe(true); // exactly at expiry = expired
  });
});
