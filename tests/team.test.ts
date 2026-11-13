import { describe, expect, it } from "vitest";
import {
  canAcceptInvite,
  canManage,
  effectiveInviteStatus,
  inviteEmailText,
  invitePath,
  isAssignableRole,
  isValidEmail,
  normalizeEmail,
} from "@/lib/team";

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

describe("email helpers", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  A@B.Com ")).toBe("a@b.com");
  });

  it("validates simple addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("A@B.CO ")).toBe(true);
  });
});

describe("isAssignableRole / canManage", () => {
  it("allows only admin and member on invites", () => {
    expect(isAssignableRole("admin")).toBe(true);
    expect(isAssignableRole("member")).toBe(true);
    expect(isAssignableRole("owner")).toBe(false);
    expect(isAssignableRole("superuser")).toBe(false);
  });

  it("owners and admins can manage", () => {
    expect(canManage("owner")).toBe(true);
    expect(canManage("admin")).toBe(true);
    expect(canManage("member")).toBe(false);
  });
});

describe("effectiveInviteStatus", () => {
  it("passes through accepted and revoked", () => {
    expect(effectiveInviteStatus({ status: "accepted", expiresAt: past })).toBe("accepted");
    expect(effectiveInviteStatus({ status: "revoked", expiresAt: future })).toBe("revoked");
  });

  it("expires pending invites past their deadline", () => {
    expect(effectiveInviteStatus({ status: "pending", expiresAt: future })).toBe("pending");
    expect(effectiveInviteStatus({ status: "pending", expiresAt: past })).toBe("expired");
  });
});

describe("canAcceptInvite", () => {
  const invite = { status: "pending" as const, expiresAt: future, email: "Sam@Client.com" };

  it("requires a signed-in matching email", () => {
    expect(canAcceptInvite(invite, undefined).ok).toBe(false);
    expect(canAcceptInvite(invite, "other@x.com").ok).toBe(false);
    expect(canAcceptInvite(invite, "sam@client.com").ok).toBe(true);
  });

  it("rejects accepted, revoked and expired invites", () => {
    expect(
      canAcceptInvite({ ...invite, status: "accepted" }, "sam@client.com").ok,
    ).toBe(false);
    expect(
      canAcceptInvite({ ...invite, status: "revoked" }, "sam@client.com").ok,
    ).toBe(false);
    expect(
      canAcceptInvite({ ...invite, expiresAt: past }, "sam@client.com").ok,
    ).toBe(false);
  });
});

describe("invitePath / inviteEmailText", () => {
  it("builds the invite path", () => {
    expect(invitePath("abc123")).toBe("/invite/abc123");
  });

  it("includes workspace, role and url in the email body", () => {
    const text = inviteEmailText({
      inviterName: "Ada",
      workspaceName: "Acme Studio",
      role: "admin",
      url: "https://example.com/invite/tok",
    });
    expect(text).toContain("Ada");
    expect(text).toContain("Acme Studio");
    expect(text).toContain("admin");
    expect(text).toContain("https://example.com/invite/tok");
  });
});
