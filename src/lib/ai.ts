/**
 * Phase 5 — AI document generation & writing assistant.
 *
 * Talks to any OpenAI-compatible chat-completions endpoint:
 *   AI_API_KEY   (required to enable)
 *   AI_BASE_URL  (default https://api.openai.com/v1)
 *   AI_MODEL     (default gpt-4o-mini)
 *
 * Prompt builders are pure so they can be unit-tested without a network.
 */

export const GENERATE_KINDS = [
  "letter",
  "quote_description",
  "proposal",
  "payment_request",
  "agreement",
  "followup",
  "client_message",
] as const;
export type GenerateKind = (typeof GENERATE_KINDS)[number];

export const ASSIST_OPERATIONS = [
  "grammar",
  "rewrite",
  "formal",
  "concise",
  "translate",
  "title",
  "terms",
  "improve_description",
] as const;
export type AssistOperation = (typeof ASSIST_OPERATIONS)[number];

export const TEXT_SLOTS = ["subject", "body", "terms"] as const;
export type TextSlot = (typeof TEXT_SLOTS)[number];

/** Input text is capped so a runaway paste can't blow the request. */
export const MAX_INPUT_CHARS = 8000;
export const MAX_OUTPUT_CHARS = 4000;

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

function baseUrl(): string {
  return (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
}

function model(): string {
  return process.env.AI_MODEL || "gpt-4o-mini";
}

/** Trim and hard-cap user-supplied text before it goes into a prompt. */
export function clampInput(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_INPUT_CHARS) return trimmed;
  return trimmed.slice(0, MAX_INPUT_CHARS);
}

const GENERATE_RULES: Record<GenerateKind, { title: string; instructions: string }> = {
  letter: {
    title: "business letter",
    instructions:
      "Write a professional business letter. Return only the letter body (no subject line, no markdown headings). Start with an appropriate salutation and end with a sign-off placeholder 'Kind regards,' on its own line.",
  },
  quote_description: {
    title: "quotation line description",
    instructions:
      "Write a clear, professional description for a quotation line item or the summary of a quotation. One short paragraph, plain text, no greetings or sign-offs.",
  },
  proposal: {
    title: "project proposal",
    instructions:
      "Write a concise project proposal draft: objective, proposed scope, approach, and expected outcome. Plain text with short paragraphs. No markdown headings.",
  },
  payment_request: {
    title: "payment request letter",
    instructions:
      "Write a polite but firm payment request. Reference the outstanding amount and due date if provided. End with 'Kind regards,' on its own line. Do not invent legal threats.",
  },
  agreement: {
    title: "service agreement draft",
    instructions:
      "Write a simple service-agreement draft: parties, scope of services, fees and payment terms, term and termination, and general provisions. Plain text. Clearly a draft for professional review.",
  },
  followup: {
    title: "follow-up email",
    instructions:
      "Write a short follow-up email (3-5 sentences) that is friendly, specific and actionable. Plain text only.",
  },
  client_message: {
    title: "client message",
    instructions:
      "Write a short professional message to a client. Plain text, 2-4 sentences, no subject line.",
  },
};

const ASSIST_RULES: Record<AssistOperation, string> = {
  grammar: "Fix grammar, spelling and punctuation. Keep the meaning, tone and length as close to the original as possible.",
  rewrite: "Rewrite the text to be clearer and more professional while preserving its meaning.",
  formal: "Make the text more formal in tone without adding new information.",
  concise: "Make the text more concise — cut redundancy, keep every essential fact.",
  translate: "Translate the text into the same language as the surrounding business context if a target is given, otherwise into English. Return only the translation.",
  title: "Suggest ONE document title (max 60 characters). Return only the title, no quotes or commentary.",
  terms: "Suggest professional terms & conditions for this document. Plain text, 3-6 short clauses, numbered.",
  improve_description: "Improve this product or service description so it reads clearly and persuasively. Keep it a short paragraph.",
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Prompt for §14.1 AI document generation. Pure. */
export function buildGenerateMessages(
  kind: GenerateKind,
  input: { prompt: string; context?: string },
): ChatMessage[] {
  const rules = GENERATE_RULES[kind] ?? GENERATE_RULES.letter;
  const prompt = clampInput(input.prompt);
  const context = input.context ? clampInput(input.context) : "";
  return [
    {
      role: "system",
      content:
        `You are the writing assistant inside Letterpad, a business document app. ` +
        `Draft a ${rules.title}. ${rules.instructions} ` +
        `Output plain text only — no markdown, no preamble, no commentary.`,
    },
    {
      role: "user",
      content: [
        context ? `Business / document context:\n${context}` : "",
        `Request:\n${prompt}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];
}

/** Prompt for §14.2 AI writing assistant. Pure. */
export function buildAssistantMessages(
  operation: AssistOperation,
  text: string,
  extra?: { targetLanguage?: string },
): ChatMessage[] {
  const rule = ASSIST_RULES[operation] ?? ASSIST_RULES.rewrite;
  const body = clampInput(text);
  const languageNote =
    operation === "translate" && extra?.targetLanguage
      ? ` Target language: ${extra.targetLanguage}.`
      : "";
  return [
    {
      role: "system",
      content:
        `You are the writing assistant inside Letterpad, a business document app. ` +
        `${rule}${languageNote} ` +
        `Return only the result — no explanations, no markdown fences, no preamble.`,
    },
    { role: "user", content: body },
  ];
}

/**
 * Extract the assistant text from an OpenAI-compatible chat completion body.
 * Tolerates missing choices and strips accidental ``` fences.
 */
export function extractChatText(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const raw = data?.choices?.[0]?.message?.content;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return "";
  const unfenced = text.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "");
  return unfenced.trim().slice(0, MAX_OUTPUT_CHARS);
}

export interface AiResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** Call the chat-completions endpoint. Session-free; used by server actions. */
export async function runChat(messages: ChatMessage[]): Promise<AiResult> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI is not configured — set AI_API_KEY (and optionally AI_BASE_URL / AI_MODEL).",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model(),
        messages,
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        ok: false,
        error: `AI request failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      };
    }

    const payload: unknown = await res.json();
    const text = extractChatText(payload);
    if (!text) return { ok: false, error: "AI returned an empty response" };
    return { ok: true, text };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      error: aborted ? "AI request timed out" : "AI request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
