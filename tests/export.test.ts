import { describe, expect, it } from "vitest";
import { buildExportPayload, exportFilename } from "@/lib/export";

describe("export filename", () => {
  it("uses slug and date", () => {
    const name = exportFilename("acme-studio", new Date("2026-11-13T12:00:00Z"));
    expect(name).toBe("letterpad-export-acme-studio-2026-11-13.json");
  });

  it("sanitizes unsafe slug characters", () => {
    const name = exportFilename("../etc/passwd", new Date("2026-01-02T00:00:00Z"));
    expect(name).not.toContain("/");
    expect(name).not.toContain("..");
    expect(name).toMatch(/^letterpad-export-[a-z0-9-]+-2026-01-02\.json$/);
  });

  it("falls back when the slug is empty", () => {
    const name = exportFilename("", new Date("2026-01-02T00:00:00Z"));
    expect(name).toBe("letterpad-export-workspace-2026-01-02.json");
  });
});

describe("export payload", () => {
  it("wraps workspace + collections in a versioned envelope", () => {
    const at = new Date("2026-11-13T15:00:00.000Z");
    const payload = buildExportPayload(
      { workspace: { slug: "acme" }, data: { documents: [{ id: 1 }] } },
      at,
    );
    expect(payload.app).toBe("letterpad");
    expect(payload.formatVersion).toBe(1);
    expect(payload.exportedAt).toBe("2026-11-13T15:00:00.000Z");
    expect(payload.workspace).toEqual({ slug: "acme" });
    expect(payload.data.documents).toEqual([{ id: 1 }]);
  });
});
