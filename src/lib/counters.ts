import { formatDocumentNumber, type NumberingConfig } from "@/lib/recurring";
import type { DocumentType } from "@/lib/db/types";

export { NUMBER_PREFIX } from "@/lib/utils";

/**
 * Counter document `_id` — workspace-scoped, or profile-scoped when a
 * business profile is active (§6: separate numbering sequences).
 */
export function counterKey(
  workspaceIdHex: string,
  type: DocumentType,
  profileIdHex?: string | null,
): string {
  return profileIdHex
    ? `${workspaceIdHex}:${profileIdHex}:${type}`
    : `${workspaceIdHex}:${type}`;
}

/**
 * Atomically allocate the next document number for a workspace + type.
 *
 * Supports branding/numbering overrides via `config`:
 * - `prefix` — custom prefix (default `QTN`, `INV`, …)
 * - `pad`    — zero-pad width (default 4 → `0001`)
 * - `start`  — first sequence when the counter is created (default 1)
 *
 * When `profileIdHex` is given the sequence is scoped to that business
 * profile; otherwise it is workspace-wide.
 */
export async function nextDocumentNumber(
  workspaceIdHex: string,
  type: DocumentType,
  config?: NumberingConfig,
  profileIdHex?: string | null,
): Promise<string> {
  const { collections } = await import("@/lib/db/client");
  const key = counterKey(workspaceIdHex, type, profileIdHex);
  const start = config?.start && config.start > 0 ? config.start : 1;

  // Seed with start-1 so the subsequent $inc yields `start` on first use.
  // $setOnInsert is a no-op when the counter already exists.
  await collections
    .counters()
    .updateOne({ _id: key }, { $setOnInsert: { seq: start - 1 } }, { upsert: true });

  const counter = await collections
    .counters()
    .findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { returnDocument: "after" });

  const seq = counter?.seq ?? start;
  return formatDocumentNumber(type, seq, config);
}
