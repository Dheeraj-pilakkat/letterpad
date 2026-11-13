import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ASSIST_OPERATIONS,
  GENERATE_KINDS,
  MAX_INPUT_CHARS,
  aiConfigured,
  buildAssistantMessages,
  buildGenerateMessages,
  clampInput,
  extractChatText,
} from "@/lib/ai";

describe("aiConfigured", () => {
  const KEY = process.env.AI_API_KEY;

  afterEach(() => {
    if (KEY === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = KEY;
    vi.unstubAllEnvs();
  });

  it("is false without AI_API_KEY", () => {
    delete process.env.AI_API_KEY;
    expect(aiConfigured()).toBe(false);
  });

  it("is true with AI_API_KEY", () => {
    process.env.AI_API_KEY = "sk-test";
    expect(aiConfigured()).toBe(true);
  });
});

describe("clampInput", () => {
  it("trims whitespace", () => {
    expect(clampInput("  hello  ")).toBe("hello");
  });

  it("keeps short text as-is", () => {
    expect(clampInput("short prompt")).toBe("short prompt");
  });

  it("hard-caps long input at MAX_INPUT_CHARS", () => {
    const long = "a".repeat(MAX_INPUT_CHARS + 500);
    expect(clampInput(long)).toHaveLength(MAX_INPUT_CHARS);
  });
});

describe("buildGenerateMessages", () => {
  it("returns system + user messages for every generate kind", () => {
    for (const kind of GENERATE_KINDS) {
      const messages = buildGenerateMessages(kind, { prompt: "Write it" });
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].role).toBe("user");
      expect(messages[1].content).toContain("Write it");
      expect(messages[0].content.toLowerCase()).toContain("letterpad");
    }
  });

  it("includes context when provided", () => {
    const messages = buildGenerateMessages("payment_request", {
      prompt: "chase INV-0042",
      context: "Client: Acme · INR 15,000",
    });
    expect(messages[1].content).toContain("Acme");
    expect(messages[1].content).toContain("chase INV-0042");
  });

  it("omits the context block when absent", () => {
    const messages = buildGenerateMessages("letter", { prompt: "hello" });
    expect(messages[1].content).not.toContain("Business / document context");
  });
});

describe("buildAssistantMessages", () => {
  it("returns system + user messages for every assist operation", () => {
    for (const operation of ASSIST_OPERATIONS) {
      const messages = buildAssistantMessages(operation, "Some draft text.");
      expect(messages).toHaveLength(2);
      expect(messages[1].content).toBe("Some draft text.");
      expect(messages[0].content.toLowerCase()).toContain("letterpad");
    }
  });

  it("adds the target language for translate", () => {
    const messages = buildAssistantMessages("translate", "Hello", {
      targetLanguage: "Spanish",
    });
    expect(messages[0].content).toContain("Spanish");
  });

  it("does not add a language note for non-translate ops", () => {
    const messages = buildAssistantMessages("grammar", "Hello");
    expect(messages[0].content).not.toContain("Target language");
  });
});

describe("extractChatText", () => {
  it("returns empty string for missing choices", () => {
    expect(extractChatText(undefined)).toBe("");
    expect(extractChatText({})).toBe("");
    expect(extractChatText({ choices: [] })).toBe("");
    expect(extractChatText({ choices: [{ message: {} }] })).toBe("");
  });

  it("returns trimmed content", () => {
    expect(
      extractChatText({ choices: [{ message: { content: "  hi there  " } }] }),
    ).toBe("hi there");
  });

  it("strips markdown fences", () => {
    const payload = {
      choices: [{ message: { content: "```text\nDear client,\n```" } }],
    };
    expect(extractChatText(payload)).toBe("Dear client,");
  });

  it("caps output at MAX_OUTPUT_CHARS", () => {
    const payload = {
      choices: [{ message: { content: "x".repeat(10_000) } }],
    };
    expect(extractChatText(payload).length).toBeLessThanOrEqual(4000);
  });

  it("ignores non-string content", () => {
    expect(
      extractChatText({ choices: [{ message: { content: { evil: true } } }] }),
    ).toBe("");
  });
});
