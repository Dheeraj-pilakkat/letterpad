/**
 * Workspace data export (§22 — data export).
 * Pure builders so the route stays thin and testable.
 */

export interface ExportInput {
  workspace: Record<string, unknown>;
  data: Record<string, unknown[]>;
}

export interface ExportPayload {
  app: "letterpad";
  formatVersion: 1;
  exportedAt: string;
  workspace: Record<string, unknown>;
  data: Record<string, unknown[]>;
}

/** JSON export envelope for one workspace. */
export function buildExportPayload(
  input: ExportInput,
  at: Date = new Date(),
): ExportPayload {
  return {
    app: "letterpad",
    formatVersion: 1,
    exportedAt: at.toISOString(),
    workspace: input.workspace,
    data: input.data,
  };
}

/** Attachment filename: letterpad-export-<slug>-YYYY-MM-DD.json */
export function exportFilename(slug: string, at: Date = new Date()): string {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 60) || "workspace";
  const day = at.toISOString().slice(0, 10);
  return `letterpad-export-${safeSlug}-${day}.json`;
}
