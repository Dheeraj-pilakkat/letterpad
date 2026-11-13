import { describe, expect, it } from "vitest";
import { VALID_TRANSITIONS } from "@/lib/constants";
import type { DocumentStatus } from "@/lib/db/types";
import { computeTotals } from "@/lib/validation/schemas";

/**
 * Workflow tests: status lifecycle + money path used by the editor
 * (server re-validates the same helpers in updateDocument).
 */

const ALL: DocumentStatus[] = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "accepted",
  "rejected",
  "expired",
  "overdue",
  "void",
];

function canMove(from: DocumentStatus, to: DocumentStatus): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

describe("status workflow", () => {
  it("allows the happy path draft → sent → viewed → paid", () => {
    expect(canMove("draft", "sent")).toBe(true);
    expect(canMove("sent", "viewed")).toBe(true);
    expect(canMove("viewed", "paid")).toBe(true);
  });

  it("allows draft → sent → accepted without viewed", () => {
    expect(canMove("sent", "accepted")).toBe(true);
  });

  it("blocks skipping sent from draft", () => {
    expect(canMove("draft", "viewed")).toBe(false);
    expect(canMove("draft", "paid")).toBe(false);
    expect(canMove("draft", "accepted")).toBe(false);
  });

  it("blocks paid → draft (terminal except void)", () => {
    expect(canMove("paid", "draft")).toBe(false);
    expect(canMove("paid", "sent")).toBe(false);
    expect(canMove("paid", "viewed")).toBe(false);
    expect(canMove("paid", "void")).toBe(true);
  });

  it("blocks rejected → paid directly", () => {
    expect(canMove("rejected", "paid")).toBe(false);
    expect(canMove("rejected", "draft")).toBe(true);
  });

  it("allows overdue to resolve to paid or void", () => {
    expect(canMove("overdue", "paid")).toBe(true);
    expect(canMove("overdue", "void")).toBe(true);
    expect(canMove("overdue", "accepted")).toBe(false);
  });

  it("expired can return to draft or void", () => {
    expect(canMove("expired", "draft")).toBe(true);
    expect(canMove("expired", "void")).toBe(true);
    expect(canMove("expired", "paid")).toBe(false);
  });

  it("sent/viewed quotes can expire (cron and manual)", () => {
    expect(canMove("sent", "expired")).toBe(true);
    expect(canMove("viewed", "expired")).toBe(true);
    expect(canMove("draft", "expired")).toBe(false);
    expect(canMove("paid", "expired")).toBe(false);
  });

  it("void can be un-voided only to draft", () => {
    expect(canMove("void", "draft")).toBe(true);
    expect(canMove("void", "sent")).toBe(false);
    expect(canMove("void", "paid")).toBe(false);
  });

  it("every status can reach void or is already void (recoverable path)", () => {
    for (const from of ALL) {
      if (from === "void") continue;
      expect(canMove(from, "void")).toBe(true);
    }
  });

  it("every target of every transition is a known status", () => {
    for (const from of ALL) {
      for (const to of VALID_TRANSITIONS[from] ?? []) {
        expect(ALL).toContain(to);
      }
    }
  });
});

describe("editor money workflow", () => {
  it("recomputes totals from live line items with discount", () => {
    // Mirrors document-editor save path: computeTotals(liveItems, discount)
    const liveItems = [
      { quantity: 2, unitPrice: 500, taxRate: 18 },
      { quantity: 1, unitPrice: 100, taxRate: 0 },
    ];
    const discount = { type: "percent" as const, value: 10 };
    const totals = computeTotals(liveItems, discount);

    expect(totals.subtotal).toBe(1100);
    expect(totals.discountTotal).toBe(110);
    // raw tax = 180; scaled by 990/1100 → 162; total = 990 + 162
    expect(totals.taxTotal).toBe(162);
    expect(totals.total).toBe(1152);
    expect(totals.total).toBe(
      Math.round((totals.subtotal - totals.discountTotal + totals.taxTotal) * 100) /
        100,
    );
  });

  it("zeroes totals when all lines are removed", () => {
    expect(computeTotals([], { type: "amount", value: 50 })).toEqual({
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });
});

describe("soft-delete filter semantics", () => {
  // MongoDB `{ deletedAt: null }` matches both missing and explicit null.
  // We model documents the same way: missing field ≡ not trashed.
  function isLive(doc: { deletedAt?: Date | null }): boolean {
    return doc.deletedAt === undefined || doc.deletedAt === null;
  }

  it("treats missing deletedAt as live", () => {
    expect(isLive({})).toBe(true);
  });

  it("treats explicit null as live", () => {
    expect(isLive({ deletedAt: null })).toBe(true);
  });

  it("treats a Date as trashed", () => {
    expect(isLive({ deletedAt: new Date() })).toBe(false);
  });
});
