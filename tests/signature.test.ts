import { describe, expect, it } from "vitest";
import {
  paymentConfirmationEmail,
  paymentReminderEmail,
  reviewRequestEmail,
  SIGNATURE_MAX_BYTES,
  signatureMethodLabel,
  typedSignatureText,
  validateSignatureImage,
} from "@/lib/signature";
import { ACTIVITY_LABELS } from "@/lib/constants";

// A 1x1 transparent PNG
const PNG = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`;
const JPEG = `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==`;

function bigDataUri(): string {
  // ~250KB of base64 noise in a PNG shell
  const noise = "A".repeat(Math.ceil((SIGNATURE_MAX_BYTES * 4) / 3) + 1000);
  return `data:image/png;base64,${noise}`;
}

describe("validateSignatureImage", () => {
  it("accepts a small PNG", () => {
    expect(validateSignatureImage(PNG).ok).toBe(true);
  });

  it("accepts a small JPEG", () => {
    expect(validateSignatureImage(JPEG).ok).toBe(true);
  });

  it("rejects non-image data URIs", () => {
    expect(validateSignatureImage("data:text/plain;base64,aGk=").ok).toBe(false);
    expect(validateSignatureImage("https://example.com/sig.png").ok).toBe(false);
    expect(validateSignatureImage("").ok).toBe(false);
  });

  it("rejects images over 200KB", () => {
    const res = validateSignatureImage(bigDataUri());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/200KB/);
  });
});

describe("typedSignatureText", () => {
  it("trims and collapses whitespace", () => {
    expect(typedSignatureText("  Ada   Lovelace  ")).toBe("Ada Lovelace");
  });

  it("caps length at 80 characters", () => {
    expect(typedSignatureText("x".repeat(200))).toHaveLength(80);
  });
});

describe("reviewRequestEmail", () => {
  it("builds a signature request with number and link", () => {
    const mail = reviewRequestEmail({
      workspaceName: "Acme Studio",
      docNumber: "QT-1042",
      label: "Quote",
      url: "https://example.com/portal/abc123/doc",
      kind: "signature",
      clientName: "Ravi",
    });
    expect(mail.subject).toContain("QT-1042");
    expect(mail.subject).toContain("Signature requested");
    expect(mail.text).toContain("Ravi");
    expect(mail.text).toContain("sign Quote QT-1042");
    expect(mail.text).toContain("https://example.com/portal/abc123/doc");
    expect(mail.text).toContain("Acme Studio");
  });

  it("builds an approval request", () => {
    const mail = reviewRequestEmail({
      workspaceName: "Acme Studio",
      docNumber: "QT-1042",
      label: "Quote",
      url: "https://example.com/share/xyz",
      kind: "approval",
    });
    expect(mail.subject).toContain("Please review");
    expect(mail.text).toContain("approve Quote QT-1042");
    expect(mail.text).toContain("https://example.com/share/xyz");
    expect(mail.text).toContain("Hello,");
  });
});

describe("paymentReminderEmail", () => {
  it("includes amount, balance and link", () => {
    const mail = paymentReminderEmail({
      workspaceName: "Acme Studio",
      docNumber: "INV-77",
      balance: 1200.5,
      currency: "INR",
      dueDate: "2026-11-01",
      url: "https://example.com/portal/abc/inv77",
      contactName: "Meera",
    });
    expect(mail.subject).toContain("INV-77");
    expect(mail.subject).toContain("1200.50");
    expect(mail.text).toContain("Meera");
    expect(mail.text).toContain("1200.50 INR");
    expect(mail.text).toContain("due on 2026-11-01");
    expect(mail.text).toContain("https://example.com/portal/abc/inv77");
    expect(mail.text).toContain("disregard");
  });

  it("mentions overdue days when provided", () => {
    const mail = paymentReminderEmail({
      workspaceName: "Acme",
      docNumber: "INV-78",
      balance: 10,
      currency: "USD",
      dueDate: "2026-10-01",
      url: "https://x.test/d",
      overdueDays: 5,
    });
    expect(mail.text).toContain("5 days overdue");
  });
});

describe("paymentConfirmationEmail", () => {
  it("states the amount received", () => {
    const mail = paymentConfirmationEmail({
      workspaceName: "Acme Studio",
      docNumber: "INV-90",
      amount: 500,
      currency: "USD",
      date: "2026-11-12",
      contactName: "Jo",
    });
    expect(mail.subject).toContain("Payment received");
    expect(mail.text).toContain("Jo");
    expect(mail.text).toContain("500.00 USD");
    expect(mail.text).toContain("fully paid");
  });

  it("keeps a remaining-balance line when partially paid", () => {
    const mail = paymentConfirmationEmail({
      workspaceName: "Acme",
      docNumber: "INV-91",
      amount: 100,
      currency: "USD",
      date: "2026-11-12",
      remaining: 250,
    });
    expect(mail.text).toContain("250.00 USD remains");
    expect(mail.text).not.toContain("fully paid");
  });
});

describe("signatureMethodLabel", () => {
  it("labels every method", () => {
    expect(signatureMethodLabel("drawn")).toContain("drawn");
    expect(signatureMethodLabel("typed")).toContain("typed");
    expect(signatureMethodLabel("uploaded")).toContain("uploaded");
  });
});

describe("activity labels for Phase 3", () => {
  it("includes signed and reminder", () => {
    expect(ACTIVITY_LABELS.signed).toBe("Signed");
    expect(ACTIVITY_LABELS.reminder).toBe("Reminder");
  });
});
