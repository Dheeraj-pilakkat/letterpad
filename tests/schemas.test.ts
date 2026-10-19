import { describe, expect, it } from "vitest";
import {
  contactSchema,
  documentSchema,
  workspaceSchema,
} from "@/lib/validation/schemas";
import { VALID_TRANSITIONS } from "@/lib/constants";
import type { DocumentStatus } from "@/lib/db/types";

const validDoc = {
  templateId: "quote-classic",
  contactId: "",
  issueDate: "2026-10-19",
  currency: "USD",
  content: {},
};

describe("documentSchema", () => {
  it("accepts a minimal valid document", () => {
    const parsed = documentSchema.safeParse(validDoc);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.items).toEqual([]);
  });

  it("accepts items with custom column values", () => {
    const parsed = documentSchema.safeParse({
      ...validDoc,
      customColumns: [
        { id: "col-a", label: "Discount", type: "number" },
        { id: "col-b", label: "SLA", type: "text" },
      ],
      items: [
        {
          description: "Design work",
          quantity: 2,
          unitPrice: 100,
          taxRate: 18,
          values: { "col-a": "10", "col-b": "4h" },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects more than 4 custom columns", () => {
    const parsed = documentSchema.safeParse({
      ...validDoc,
      customColumns: Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        label: `Col ${i}`,
        type: "text",
      })),
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown custom column types and empty labels", () => {
    expect(
      documentSchema.safeParse({
        ...validDoc,
        customColumns: [{ id: "x", label: "Ok", type: "currency" }],
      }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({
        ...validDoc,
        customColumns: [{ id: "x", label: "   ", type: "text" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid accent color", () => {
    expect(
      documentSchema.safeParse({ ...validDoc, accentColor: "red" }).success,
    ).toBe(false);
    expect(
      documentSchema.safeParse({ ...validDoc, accentColor: "#B4552D" }).success,
    ).toBe(true);
  });

  it("rejects an item with no description", () => {
    expect(
      documentSchema.safeParse({
        ...validDoc,
        items: [{ description: "  ", quantity: 1, unitPrice: 10, taxRate: 0 }],
      }).success,
    ).toBe(false);
  });

  it("rejects zero or negative quantity", () => {
    expect(
      documentSchema.safeParse({
        ...validDoc,
        items: [{ description: "x", quantity: 0, unitPrice: 10, taxRate: 0 }],
      }).success,
    ).toBe(false);
  });

  it("caps items at 200 rows", () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      description: `Item ${i}`,
      quantity: 1,
      unitPrice: 1,
      taxRate: 0,
    }));
    expect(documentSchema.safeParse({ ...validDoc, items }).success).toBe(false);
  });

  it("requires a valid issue date format", () => {
    expect(
      documentSchema.safeParse({ ...validDoc, issueDate: "19/10/2026" }).success,
    ).toBe(false);
  });
});

describe("workspaceSchema", () => {
  const base = { name: "Acme Studio", currency: "USD", taxRate: 18, brandColor: "#B4552D" };

  it("accepts a minimal workspace", () => {
    expect(workspaceSchema.safeParse(base).success).toBe(true);
  });

  it("accepts 1–6 brand colors", () => {
    expect(
      workspaceSchema.safeParse({ ...base, brandColors: ["#B4552D"] }).success,
    ).toBe(true);
    expect(
      workspaceSchema.safeParse({
        ...base,
        brandColors: ["#B4552D", "#1C2536", "#2F5D50", "#7A3E65", "#1F4E79", "#8A5A12"],
      }).success,
    ).toBe(true);
    expect(
      workspaceSchema.safeParse({
        ...base,
        brandColors: ["#B4552D", "#1C2536", "#2F5D50", "#7A3E65", "#1F4E79", "#8A5A12", "#111111"],
      }).success,
    ).toBe(false);
  });

  it("rejects an empty brand palette", () => {
    expect(
      workspaceSchema.safeParse({ ...base, brandColors: [] }).success,
    ).toBe(false);
  });

  it("accepts empty-string logo but rejects non-image data", () => {
    expect(workspaceSchema.safeParse({ ...base, logo: "" }).success).toBe(true);
    expect(
      workspaceSchema.safeParse({ ...base, logo: "data:text/plain;base64,SGVsbG8=" })
        .success,
    ).toBe(false);
  });

  it("rejects out-of-range tax rate", () => {
    expect(workspaceSchema.safeParse({ ...base, taxRate: 101 }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...base, taxRate: -1 }).success).toBe(false);
  });

  it("requires a business name of at least 2 characters", () => {
    expect(workspaceSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
  });
});

describe("contactSchema", () => {
  it("requires a name and validates email when present", () => {
    expect(contactSchema.safeParse({ name: "Ada" }).success).toBe(true);
    expect(contactSchema.safeParse({ name: "" }).success).toBe(false);
    expect(
      contactSchema.safeParse({ name: "Ada", email: "not-an-email" }).success,
    ).toBe(false);
    expect(contactSchema.safeParse({ name: "Ada", email: "" }).success).toBe(true);
  });
});

describe("VALID_TRANSITIONS", () => {
  const statuses: DocumentStatus[] = ["draft", "sent", "paid", "accepted", "void"];

  it("covers every status", () => {
    for (const s of statuses) expect(VALID_TRANSITIONS[s]).toBeDefined();
  });

  it("draft can only go to sent or void", () => {
    expect(VALID_TRANSITIONS.draft.sort()).toEqual(["sent", "void"]);
  });

  it("paid and accepted are terminal except void", () => {
    expect(VALID_TRANSITIONS.paid).toEqual(["void"]);
    expect(VALID_TRANSITIONS.accepted).toEqual(["void"]);
  });

  it("void can return to draft only", () => {
    expect(VALID_TRANSITIONS.void).toEqual(["draft"]);
  });

  it("only targets known statuses", () => {
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const t of targets) expect(statuses).toContain(t);
    }
  });
});
