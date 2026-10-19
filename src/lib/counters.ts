import { padNumber } from "@/lib/utils";
import type { DocumentType } from "@/lib/db/types";

export const NUMBER_PREFIX: Record<DocumentType, string> = {
  letter: "LTR",
  quote: "QTN",
  invoice: "INV",
  receipt: "RCT",
  request: "REQ",
};

/**
 * Atomically allocate the next document number for a workspace + type.
 * `QTN-0001`, `INV-0001`, … Counter document `_id` is `${workspaceId}:${type}`.
 */
export async function nextDocumentNumber(
  workspaceIdHex: string,
  type: DocumentType,
): Promise<string> {
  const { collections } = await import("@/lib/db/client");
  const key = `${workspaceIdHex}:${type}`;
  const counter = await collections
    .counters()
    .findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  const seq = counter?.seq ?? 1;
  return `${NUMBER_PREFIX[type]}-${padNumber(seq)}`;
}
