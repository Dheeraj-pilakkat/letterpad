import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { DocumentPdf } from "@/pdf/DocumentPdf";
import {
  sampleContact,
  sampleDocument,
  sampleWorkspace,
} from "@/lib/templates/sample";
import { TEMPLATES, templateById } from "@/lib/templates/registry";
import { generateShareToken, appBaseUrl, mailtoHref } from "@/lib/share";
import type { DocumentType } from "@/lib/db/types";

function renderTemplate(templateId: string, type: DocumentType) {
  const def = templateById(templateId);
  const layout = def?.layout ?? {};
  const doc = sampleDocument(type, templateId, layout);
  return renderToBuffer(
    <DocumentPdf workspace={sampleWorkspace} doc={doc} contact={sampleContact} />,
  );
}

describe("PDF generation (Phase 1 milestone)", () => {
  it("renders an invoice PDF buffer starting with %PDF", async () => {
    const buffer = await renderTemplate("invoice-classic", "invoice");
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 20000);

  it("renders every template in the registry", async () => {
    for (const t of TEMPLATES) {
      const buffer = await renderTemplate(t.id, t.type);
      expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
    }
  }, 60000);

  it("renders a GST invoice with HSN column and reverse charge", async () => {
    const layout = templateById("invoice-classic")?.layout ?? {};
    const doc = {
      ...sampleDocument("invoice", "invoice-classic", layout),
      reverseCharge: true,
      items: sampleDocument("invoice", "invoice-classic", layout).items.map((item) => ({
        ...item,
        hsn: "998314",
      })),
      layout: { ...layout, columns: { hsn: true } },
    };
    const buffer = await renderToBuffer(
      <DocumentPdf workspace={sampleWorkspace} doc={doc} contact={sampleContact} />,
    );
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 20000);

  it("renders the proforma invoice title", async () => {
    const buffer = await renderTemplate("invoice-proforma", "invoice");
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 20000);
});

describe("share helpers", () => {
  it("generates unique lower-case tokens", () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).toHaveLength(32);
    expect(a).toMatch(/^[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it("builds app-relative share URLs", () => {
    expect(appBaseUrl()).toMatch(/^https?:\/\//);
  });

  it("builds mailto fallbacks without a Resend key path", () => {
    const href = mailtoHref({
      to: "client@example.com",
      subject: "Your invoice",
      text: "Hello",
    });
    expect(href.startsWith("mailto:")).toBe(true);
    expect(href).toContain("client%40example.com");
  });
});
