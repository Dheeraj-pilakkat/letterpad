import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneAndUpdate = vi.fn();
vi.mock("@/lib/db/client", () => ({
  collections: {
    counters: () => ({ findOneAndUpdate }),
  },
}));

import { nextDocumentNumber, NUMBER_PREFIX } from "@/lib/counters";

beforeEach(() => {
  findOneAndUpdate.mockReset();
});

describe("nextDocumentNumber", () => {
  it("formats a zero-padded number with the type prefix", async () => {
    findOneAndUpdate.mockResolvedValueOnce({ seq: 7 });
    await expect(nextDocumentNumber("abc123", "quote")).resolves.toBe("QTN-0007");
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "abc123:quote" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  });

  it("starts at 1 when the counter document is new", async () => {
    // upsert returns null for a brand-new counter in some driver versions
    findOneAndUpdate.mockResolvedValueOnce(null);
    await expect(nextDocumentNumber("ws1", "invoice")).resolves.toBe("INV-0001");
  });

  it("keeps incrementing per workspace+type independently", async () => {
    findOneAndUpdate.mockResolvedValueOnce({ seq: 42 });
    findOneAndUpdate.mockResolvedValueOnce({ seq: 1 });
    await expect(nextDocumentNumber("ws1", "letter")).resolves.toBe("LTR-0042");
    await expect(nextDocumentNumber("ws2", "letter")).resolves.toBe("LTR-0001");
    expect(findOneAndUpdate.mock.calls[0][0]._id).toBe("ws1:letter");
    expect(findOneAndUpdate.mock.calls[1][0]._id).toBe("ws2:letter");
  });

  it("uses the five document prefixes", () => {
    expect(NUMBER_PREFIX).toEqual({
      letter: "LTR",
      quote: "QTN",
      invoice: "INV",
      receipt: "RCT",
      request: "REQ",
    });
  });

  it("pads to four digits but keeps larger numbers intact", async () => {
    findOneAndUpdate.mockResolvedValueOnce({ seq: 12345 });
    await expect(nextDocumentNumber("ws1", "request")).resolves.toBe("REQ-12345");
  });
});
