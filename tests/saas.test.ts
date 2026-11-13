import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateApiKey, isApiKey, maskApiKey } from "@/lib/api-key";
import {
  buildWebhookEvent,
  deliverWebhook,
  signWebhookPayload,
  newWebhookSecret,
} from "@/lib/webhooks";
import { periodEndIso } from "@/lib/subscription";
import { ObjectId } from "mongodb";

describe("public API keys", () => {
  it("generates lpk_ keys with 32 hex chars", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^lpk_[0-9a-f]{32}$/);
    expect(isApiKey(key)).toBe(true);
  });

  it("rejects malformed keys", () => {
    expect(isApiKey("")).toBe(false);
    expect(isApiKey("lpk_short")).toBe(false);
    expect(isApiKey("sk_otherprefix")).toBe(false);
    expect(isApiKey(null)).toBe(false);
    expect(isApiKey(12345)).toBe(false);
  });

  it("masks keys for display", () => {
    const key = generateApiKey();
    const masked = maskApiKey(key);
    expect(masked).toContain("…");
    expect(masked).not.toBe(key);
    const cut = masked.indexOf("…");
    expect(key.startsWith(masked.slice(0, cut))).toBe(true);
    expect(key.endsWith(masked.slice(cut + 1))).toBe(true);
  });
});

describe("webhook signing", () => {
  it("signs the raw payload with HMAC-SHA256", () => {
    const payload = JSON.stringify({ type: "document.created" });
    const secret = "whsec_test";
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    expect(signWebhookPayload(payload, secret)).toBe(expected);
  });

  it("different secrets produce different signatures", () => {
    const payload = "{}";
    expect(signWebhookPayload(payload, "a")).not.toBe(
      signWebhookPayload(payload, "b"),
    );
  });

  it("builds a well-formed event envelope", () => {
    const wsId = new ObjectId();
    const event = buildWebhookEvent({
      type: "document.status_changed",
      workspaceId: wsId,
      data: { id: "abc", from: "draft", to: "sent" },
    });
    expect(event.type).toBe("document.status_changed");
    expect(event.workspaceId).toBe(wsId.toHexString());
    expect(event.data).toEqual({ id: "abc", from: "draft", to: "sent" });
    expect(event.id).toMatch(/^[0-9a-f]{16}$/);
    expect(Number.isNaN(Date.parse(event.createdAt))).toBe(false);
  });

  it("generates whsec_ secrets", () => {
    const secret = newWebhookSecret();
    expect(secret).toMatch(/^whsec_[0-9a-f]{32}$/);
  });

  it("does not deliver when disabled or unconfigured", async () => {
    const event = buildWebhookEvent({
      type: "document.created",
      workspaceId: new ObjectId(),
      data: {},
    });
    expect(
      await deliverWebhook(
        { url: "https://example.com/hook", secret: "s", enabled: false, createdAt: new Date() },
        event,
      ),
    ).toBe(false);
    expect(
      await deliverWebhook(
        { url: "", secret: "s", enabled: true, createdAt: new Date() },
        event,
      ),
    ).toBe(false);
    expect(
      await deliverWebhook(
        { url: "https://example.com/hook", secret: "", enabled: true, createdAt: new Date() },
        event,
      ),
    ).toBe(false);
  });
});

describe("subscription periods", () => {
  it("bumps one month ahead", () => {
    expect(periodEndIso(new Date("2026-01-15T10:00:00Z"))).toBe("2026-02-15");
    expect(periodEndIso(new Date("2026-11-30T10:00:00Z"))).toBe("2026-12-30");
  });

  it("returns a YYYY-MM-DD string", () => {
    expect(periodEndIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
