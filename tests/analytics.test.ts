import { describe, expect, it } from "vitest";
import {
  classifyQuote,
  quoteConversion,
  rangeToMonths,
  topClients,
} from "@/lib/analytics";

describe("classifyQuote", () => {
  it("maps statuses to outcomes", () => {
    expect(classifyQuote("accepted")).toBe("won");
    expect(classifyQuote("paid")).toBe("won");
    expect(classifyQuote("rejected")).toBe("lost");
    expect(classifyQuote("expired")).toBe("expired");
    expect(classifyQuote("sent")).toBe("open");
    expect(classifyQuote("viewed")).toBe("open");
    expect(classifyQuote("overdue")).toBe("open");
  });
});

describe("quoteConversion", () => {
  it("excludes drafts and voids from sent", () => {
    const stats = quoteConversion(["draft", "draft", "void", "sent"]);
    expect(stats.sent).toBe(1);
    expect(stats.open).toBe(1);
  });

  it("computes win rate over decided quotes only", () => {
    const stats = quoteConversion(["accepted", "accepted", "rejected", "sent"]);
    expect(stats.sent).toBe(4);
    expect(stats.won).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.open).toBe(1);
    expect(stats.winRate).toBe(66.67);
  });

  it("returns 0% when nothing was decided", () => {
    const stats = quoteConversion(["sent", "viewed"]);
    expect(stats.winRate).toBe(0);
    expect(stats.sent).toBe(2);
  });

  it("counts expired separately", () => {
    const stats = quoteConversion(["expired", "expired", "rejected"]);
    expect(stats.expired).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.winRate).toBe(0);
  });
});

describe("topClients", () => {
  const rows = [
    { contactId: "a", amount: 100 },
    { contactId: "b", amount: 300 },
    { contactId: "a", amount: 150 },
    { contactId: null, amount: 999 },
    { contactId: "c", amount: -10 },
    { contactId: "b", amount: 50 },
  ];

  it("sums per contact, skips null/negative, sorts desc", () => {
    expect(topClients(rows)).toEqual([
      { contactId: "b", total: 350 },
      { contactId: "a", total: 250 },
    ]);
  });

  it("honours the limit and breaks ties by id", () => {
    const tied = [
      { contactId: "z", amount: 10 },
      { contactId: "a", amount: 10 },
      { contactId: "m", amount: 10 },
    ];
    expect(topClients(tied, 2).map((r) => r.contactId)).toEqual(["a", "m"]);
    expect(topClients(rows, 1)).toHaveLength(1);
  });
});

describe("rangeToMonths", () => {
  it("maps fixed ranges", () => {
    expect(rangeToMonths("6m")).toBe(6);
    expect(rangeToMonths("12m")).toBe(12);
  });

  it("counts elapsed months for year-to-date", () => {
    expect(rangeToMonths("ytd", new Date("2026-03-15"))).toBe(3);
    expect(rangeToMonths("ytd", new Date("2026-11-01"))).toBe(11);
    expect(rangeToMonths("ytd", new Date("2026-01-01"))).toBe(1);
  });
});
