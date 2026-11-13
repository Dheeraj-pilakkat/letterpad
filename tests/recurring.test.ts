import { describe, expect, it } from "vitest";
import {
  addInterval,
  formatDocumentNumber,
  intervalLabel,
  isDue,
  isPastEnd,
  numberingConfig,
} from "@/lib/recurring";
import { formatMoney } from "@/lib/utils";

describe("addInterval", () => {
  it("advances weekly by 7 days", () => {
    expect(addInterval("2026-01-01", "weekly")).toBe("2026-01-08");
  });

  it("advances biweekly by 14 days", () => {
    expect(addInterval("2026-01-01", "biweekly")).toBe("2026-01-15");
  });

  it("advances monthly on the calendar", () => {
    expect(addInterval("2026-01-15", "monthly")).toBe("2026-02-15");
  });

  it("advances quarterly by 3 months", () => {
    expect(addInterval("2026-01-15", "quarterly")).toBe("2026-04-15");
  });

  it("advances yearly by 1 year", () => {
    expect(addInterval("2026-03-01", "yearly")).toBe("2027-03-01");
  });

  it("clamps month overflow (Jan 31 + 1 month)", () => {
    expect(addInterval("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("returns the original date when invalid", () => {
    expect(addInterval("not-a-date", "weekly")).toBe("not-a-date");
  });
});

describe("isDue / isPastEnd", () => {
  it("isDue on or before today", () => {
    expect(isDue("2026-01-01", "2026-01-05")).toBe(true);
    expect(isDue("2026-01-05", "2026-01-05")).toBe(true);
    expect(isDue("2026-01-06", "2026-01-05")).toBe(false);
    expect(isDue("", "2026-01-05")).toBe(false);
  });

  it("isPastEnd only when endDate is strictly before today", () => {
    expect(isPastEnd(undefined, "2026-01-05")).toBe(false);
    expect(isPastEnd("2026-01-04", "2026-01-05")).toBe(true);
    expect(isPastEnd("2026-01-05", "2026-01-05")).toBe(false);
  });
});

describe("numberingConfig / formatDocumentNumber", () => {
  it("falls back to defaults", () => {
    expect(numberingConfig({}, "quote")).toEqual({
      prefix: "QTN",
      pad: 4,
      start: 1,
    });
  });

  it("uses workspace overrides", () => {
    expect(
      numberingConfig(
        {
          numberPrefixes: { invoice: "BILL" },
          numberPad: 6,
          numberStarts: { invoice: 50 },
        },
        "invoice",
      ),
    ).toEqual({ prefix: "BILL", pad: 6, start: 50 });
  });

  it("formats with prefix and pad", () => {
    expect(formatDocumentNumber("invoice", 7)).toBe("INV-0007");
    expect(formatDocumentNumber("invoice", 7, { prefix: "BILL", pad: 3 })).toBe(
      "BILL-007",
    );
  });
});

describe("intervalLabel", () => {
  it("maps known intervals", () => {
    expect(intervalLabel("monthly")).toBe("Every month");
    expect(intervalLabel("quarterly")).toBe("Every quarter");
  });
});

describe("formatMoney locale-aware", () => {
  it("formats USD with en-US", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats EUR with de-DE", () => {
    const out = formatMoney(1234.5, "EUR");
    expect(out).toContain("1.234,50");
  });

  it("formats INR with en-IN grouping", () => {
    const out = formatMoney(123456.78, "INR");
    expect(out).toMatch(/₹/);
    expect(out).toContain("1,23,456.78");
  });

  it("falls back to currency code for unknown currency", () => {
    expect(formatMoney(10, "XYZ").replace(/ /g, " ")).toBe("XYZ 10.00");
  });
});
