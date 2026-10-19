import { describe, expect, it } from "vitest";
import {
  DOCUMENT_TYPES,
  TEMPLATES,
  documentLabel,
  fontFamilyTokens,
  isItemized,
  templateById,
  templatesForType,
} from "@/lib/templates/registry";

describe("template registry", () => {
  it("has 10 templates with unique ids", () => {
    expect(TEMPLATES).toHaveLength(10);
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all five document types", () => {
    for (const type of DOCUMENT_TYPES) {
      expect(templatesForType(type).length).toBeGreaterThan(0);
    }
  });

  it("every template has a name, description, kind and layout", () => {
    for (const t of TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(["itemized", "prose"]).toContain(t.kind);
      expect(t.layout).toBeTypeOf("object");
    }
  });

  it("looks up templates by id and returns undefined otherwise", () => {
    expect(templateById("quote-classic")?.type).toBe("quote");
    expect(templateById("nope")).toBeUndefined();
  });

  it("filters templates per type", () => {
    const letters = templatesForType("letter");
    expect(letters.length).toBe(3);
    expect(letters.every((t) => t.type === "letter")).toBe(true);
  });

  it("isItemized: letters are never itemized, requests depend on kind", () => {
    expect(isItemized("letter", "letter-classic")).toBe(false);
    expect(isItemized("quote", "quote-classic")).toBe(true);
    expect(isItemized("request", "request-payment")).toBe(true);
    expect(isItemized("request", "request-letter")).toBe(false);
    // kind alone is not enough for letters
    expect(isItemized("letter", "quote-classic")).toBe(false);
  });

  it("documentLabel distinguishes payment request from request letter", () => {
    expect(documentLabel("request", "request-payment")).toBe("Payment Request");
    expect(documentLabel("request", "request-letter")).toBe("Request Letter");
    expect(documentLabel("quote", "quote-classic")).toBe("Quotation");
  });
});

describe("fontFamilyTokens", () => {
  it("returns only react-pdf built-in families", () => {
    const allowed = /^(Helvetica|Times|Courier)/;
    for (const pair of ["sans", "serif", "mixed"] as const) {
      const tokens = fontFamilyTokens(pair);
      expect(tokens.body).toMatch(allowed);
      expect(tokens.display).toMatch(allowed);
      expect(tokens.italic).toMatch(allowed);
    }
  });

  it("serif pair uses Times family", () => {
    const t = fontFamilyTokens("serif");
    expect(t.body).toBe("Times-Roman");
    expect(t.display).toBe("Times-Bold");
  });
});
