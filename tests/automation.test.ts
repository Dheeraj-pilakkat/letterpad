import { describe, expect, it } from "vitest";
import {
  autoRemindersEnabled,
  canConvertToInvoice,
  isDeliveryDue,
  isQuoteExpired,
  needsOverdueMark,
  shouldAutoRemind,
  validateSendAt,
  type ReminderInput,
} from "@/lib/automation";
import {
  isValidPhone,
  normalizePhone,
  whatsappMessage,
  whatsappShareUrl,
} from "@/lib/whatsapp";

describe("isQuoteExpired", () => {
  const quote = { type: "quote" as const, status: "sent" as const, dueDate: "2026-01-10" };

  it("expires sent quotes the day after dueDate", () => {
    expect(isQuoteExpired(quote, "2026-01-11")).toBe(true);
    expect(isQuoteExpired(quote, "2026-01-10")).toBe(false);
  });

  it("never expires drafts, void or decided quotes", () => {
    expect(isQuoteExpired({ ...quote, status: "draft" }, "2026-02-01")).toBe(false);
    expect(isQuoteExpired({ ...quote, status: "void" }, "2026-02-01")).toBe(false);
    expect(isQuoteExpired({ ...quote, status: "rejected" }, "2026-02-01")).toBe(false);
    expect(isQuoteExpired({ ...quote, status: "accepted" }, "2026-02-01")).toBe(false);
  });

  it("ignores non-quotes and undated docs", () => {
    expect(
      isQuoteExpired({ type: "invoice", status: "sent", dueDate: "2026-01-01" }, "2026-02-01"),
    ).toBe(false);
    expect(isQuoteExpired({ ...quote, dueDate: undefined }, "2026-02-01")).toBe(false);
  });
});

describe("needsOverdueMark", () => {
  it("marks sent/viewed invoices past dueDate as overdue", () => {
    const doc = { type: "invoice" as const, status: "sent" as const, dueDate: "2026-01-10" };
    expect(needsOverdueMark(doc, "2026-01-11")).toBe(true);
    expect(needsOverdueMark(doc, "2026-01-10")).toBe(false);
    expect(needsOverdueMark({ ...doc, status: "viewed" as const }, "2026-02-01")).toBe(true);
  });

  it("does not touch drafts, paid, undated or non-invoices", () => {
    expect(
      needsOverdueMark({ type: "invoice", status: "draft", dueDate: "2026-01-01" }, "2026-02-01"),
    ).toBe(false);
    expect(
      needsOverdueMark({ type: "invoice", status: "paid", dueDate: "2026-01-01" }, "2026-02-01"),
    ).toBe(false);
    expect(
      needsOverdueMark({ type: "invoice", status: "sent" }, "2026-02-01"),
    ).toBe(false);
    expect(
      needsOverdueMark({ type: "quote", status: "sent", dueDate: "2026-01-01" }, "2026-02-01"),
    ).toBe(false);
  });
});

describe("canConvertToInvoice", () => {
  it("allows live quotes", () => {
    for (const status of ["sent", "viewed", "accepted", "expired"] as const) {
      expect(canConvertToInvoice({ type: "quote", status })).toBe(true);
    }
  });

  it("blocks drafts, decided and void quotes", () => {
    for (const status of ["draft", "void", "rejected"] as const) {
      expect(canConvertToInvoice({ type: "quote", status })).toBe(false);
    }
  });

  it("blocks non-quotes", () => {
    expect(canConvertToInvoice({ type: "invoice", status: "sent" })).toBe(false);
    expect(canConvertToInvoice({ type: "letter", status: "draft" })).toBe(false);
  });
});

describe("shouldAutoRemind", () => {
  const base: ReminderInput = {
    type: "invoice",
    status: "overdue",
    balance: 5000,
    hasEmail: true,
    dueDate: "2026-01-01",
    today: "2026-01-20",
  };

  it("is due for an overdue invoice with balance and email", () => {
    expect(shouldAutoRemind(base)).toEqual({ due: true });
  });

  it("rejects non-billable types", () => {
    expect(shouldAutoRemind({ ...base, type: "quote" }).reason).toBe("not-billable");
    expect(shouldAutoRemind({ ...base, type: "letter" }).reason).toBe("not-billable");
  });

  it("rejects paid/void/draft status", () => {
    expect(shouldAutoRemind({ ...base, status: "paid" }).reason).toBe("status");
    expect(shouldAutoRemind({ ...base, status: "void" }).reason).toBe("status");
    expect(shouldAutoRemind({ ...base, status: "draft" }).reason).toBe("status");
  });

  it("rejects zero balance and missing email", () => {
    expect(shouldAutoRemind({ ...base, balance: 0 }).reason).toBe("paid");
    expect(shouldAutoRemind({ ...base, hasEmail: false }).reason).toBe("no-email");
  });

  it("rejects invoices not yet due", () => {
    expect(shouldAutoRemind({ ...base, dueDate: "2026-01-25" }).reason).toBe("not-due");
  });

  it("caps automatic reminders at maxReminders", () => {
    expect(shouldAutoRemind({ ...base, reminderCount: 3 }).reason).toBe("max-reminders");
    expect(shouldAutoRemind({ ...base, reminderCount: 2 }).due).toBe(true);
  });

  it("respects the 7-day interval between reminders", () => {
    expect(
      shouldAutoRemind({ ...base, lastReminderAt: "2026-01-18" }).reason,
    ).toBe("interval");
    expect(
      shouldAutoRemind({ ...base, lastReminderAt: "2026-01-13" }).due,
    ).toBe(true);
    expect(
      shouldAutoRemind({ ...base, lastReminderAt: new Date("2026-01-13T10:00:00Z") }).due,
    ).toBe(true);
  });

  it("skips undated bills (no dueDate and no prior reminder)", () => {
    expect(shouldAutoRemind({ ...base, dueDate: undefined }).reason).toBe(
      "no-due-date",
    );
  });

  it("allows requests with a dueDate", () => {
    expect(shouldAutoRemind({ ...base, type: "request" }).due).toBe(true);
  });
});

describe("autoRemindersEnabled", () => {
  it("defaults to enabled when unset (opt-out)", () => {
    expect(autoRemindersEnabled({})).toBe(true);
    expect(autoRemindersEnabled({ autoRemindersEnabled: undefined })).toBe(true);
    expect(autoRemindersEnabled({ autoRemindersEnabled: true })).toBe(true);
  });

  it("is disabled only when explicitly false", () => {
    expect(autoRemindersEnabled({ autoRemindersEnabled: false })).toBe(false);
  });
});

describe("isDeliveryDue / validateSendAt", () => {
  const now = new Date("2026-01-15T12:00:00Z");

  it("is due once sendAt has passed", () => {
    expect(isDeliveryDue("2026-01-15T11:59:00.000Z", now)).toBe(true);
    expect(isDeliveryDue("2026-01-15T12:00:00.000Z", now)).toBe(true);
    expect(isDeliveryDue("2026-01-15T12:01:00.000Z", now)).toBe(false);
    expect(isDeliveryDue("not-a-date", now)).toBe(false);
  });

  it("requires a future time within 90 days", () => {
    expect(validateSendAt("2026-01-16T09:00:00.000Z", now).ok).toBe(true);
    expect(validateSendAt("2026-01-15T11:00:00.000Z", now)).toEqual({
      ok: false,
      error: "Delivery time must be in the future",
    });
    expect(validateSendAt("not-a-date", now).ok).toBe(false);
    expect(validateSendAt(new Date(now.getTime() + 91 * 86_400_000).toISOString(), now)).toEqual({
      ok: false,
      error: "Scheduled delivery must be within 90 days",
    });
    expect(validateSendAt(new Date(now.getTime() + 89 * 86_400_000).toISOString(), now).ok).toBe(
      true,
    );
  });
});

describe("whatsapp helpers", () => {
  it("normalizePhone strips formatting and leading 00", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizePhone("0044 20 7946 0958")).toBe("442079460958");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });

  it("isValidPhone requires 7-15 digits", () => {
    expect(isValidPhone("+91 98765 43210")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("1234567890123456")).toBe(false);
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone(undefined)).toBe(false);
  });

  it("whatsappShareUrl builds an encoded wa.me link", () => {
    const url = whatsappShareUrl("+91 98765 43210", "Hello world & more");
    expect(url).toBe(
      `https://wa.me/919876543210?text=${encodeURIComponent("Hello world & more")}`,
    );
    expect(whatsappShareUrl("", "hi")).toBe("");
  });

  const msgInput = {
    workspaceName: "Acme Studio",
    docNumber: "INV-0042",
    label: "Invoice",
    url: "https://lp.test/v/abc",
  };

  it("share messages include the document and link", () => {
    const msg = whatsappMessage({ ...msgInput, contactName: "Priya" });
    expect(msg).toContain("Hi Priya,");
    expect(msg).toContain("Invoice INV-0042 from Acme Studio");
    expect(msg).toContain("View online: https://lp.test/v/abc");
  });

  it("payment messages include the amount due", () => {
    const msg = whatsappMessage({ ...msgInput, kind: "payment", balance: 1500, currency: "INR" });
    expect(msg).toContain("payment link");
    expect(msg).toContain("Amount due: 1500.00 INR");
  });

  it("payment messages omit the amount when balance is missing", () => {
    const msg = whatsappMessage({ ...msgInput, kind: "payment" });
    expect(msg).not.toContain("Amount due");
  });

  it("reminder messages mention the outstanding balance and overdue days", () => {
    const msg = whatsappMessage({
      ...msgInput,
      kind: "reminder",
      balance: 500,
      currency: "INR",
      overdueDays: 3,
    });
    expect(msg).toContain("friendly reminder");
    expect(msg).toContain("500.00 INR");
    expect(msg).toContain("3 days overdue");
    expect(msg).toContain("awaiting payment");
  });

  it("reminder singular day uses '1 day overdue'", () => {
    const msg = whatsappMessage({
      ...msgInput,
      kind: "reminder",
      balance: 100,
      currency: "INR",
      overdueDays: 1,
    });
    expect(msg).toContain("1 day overdue");
  });
});
