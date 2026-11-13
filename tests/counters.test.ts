import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdate = vi.fn();
const updateOne = vi.fn();
vi.mock("@/lib/db/client", () => ({
  collections: {
    counters: () => ({ findOneAndUpdate, updateOne }),
  },
}));

import { nextDocumentNumber, NUMBER_PREFIX } from "@/lib/counters";

beforeEach(() => {
  findOneAndUpdate.mockReset();
  updateOne.mockReset();
});

describe("nextDocumentNumber", () => {
  it("formats a zero-padded number with the type prefix", async () => {
    updateOne.mockResolvedValueOnce({ acknowledged: true });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 7 });
    await expect(nextDocumentNumber("abc123", "quote")).resolves.toBe("QTN-0007");
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "abc123:quote" },
      { $setOnInsert: { seq: 0 } },
      { upsert: true },
    );
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "abc123:quote" },
      { $inc: { seq: 1 } },
      { returnDocument: "after" },
    );
  });

  it("starts at 1 when the counter document is new", async () => {
    updateOne.mockResolvedValueOnce({ acknowledged: true });
    findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(nextDocumentNumber("ws1", "invoice")).resolves.toBe("INV-0001");
  });

  it("keeps incrementing per workspace+type independently", async () => {
    updateOne.mockResolvedValue({ acknowledged: true });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 42 });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 1 });
    await expect(nextDocumentNumber("ws1", "letter")).resolves.toBe("LTR-0042");
    await expect(nextDocumentNumber("ws2", "letter")).resolves.toBe("LTR-0001");
    expect(findOneAndUpdate.mock.calls[0][0]._id).toBe("ws1:letter");
    expect(findOneAndUpdate.mock.calls[1][0]._id).toBe("ws2:letter");
  });

  it("uses the document prefixes for all types", () => {
    expect(NUMBER_PREFIX).toEqual({
      letter: "LTR",
      quote: "QTN",
      invoice: "INV",
      receipt: "RCT",
      request: "REQ",
      creditNote: "CRN",
      debitNote: "DBN",
    });
  });

  it("pads to four digits but keeps larger numbers intact", async () => {
    updateOne.mockResolvedValueOnce({ acknowledged: true });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 12345 });
    await expect(nextDocumentNumber("ws1", "request")).resolves.toBe("REQ-12345");
  });

  it("applies custom prefix, pad and start from config", async () => {
    updateOne.mockResolvedValueOnce({ acknowledged: true });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 100 });
    await expect(
      nextDocumentNumber("ws1", "invoice", { prefix: "BILL", pad: 5, start: 100 }),
    ).resolves.toBe("BILL-00100");
    expect(updateOne).toHaveBeenCalledWith(
      { _id: "ws1:invoice" },
      { $setOnInsert: { seq: 99 } },
      { upsert: true },
    );
  });
});
