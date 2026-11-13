"use server";

import { requireWorkspace } from "@/lib/auth/session";
import { checkAiAccess } from "@/lib/plans";
import {
  buildAssistantMessages,
  buildGenerateMessages,
  clampInput,
  runChat,
  type AssistOperation,
  type GenerateKind,
} from "@/lib/ai";

export type AiActionResult = {
  ok: boolean;
  text?: string;
  error?: string;
};

const GENERATE_KINDS = new Set([
  "letter",
  "quote_description",
  "proposal",
  "payment_request",
  "agreement",
  "followup",
  "client_message",
]);

const ASSIST_OPERATIONS = new Set([
  "grammar",
  "rewrite",
  "formal",
  "concise",
  "translate",
  "title",
  "terms",
  "improve_description",
]);

/** §14.1 — generate a draft (letter, proposal, quote description, …). */
export async function generateTextAction(
  kind: string,
  input: { prompt: string; context?: string },
): Promise<AiActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const gated = checkAiAccess(workspace);
    if (!gated.ok) return { ok: false, error: gated.error ?? "AI is plan-gated" };
    if (!GENERATE_KINDS.has(kind)) {
      return { ok: false, error: "Unknown generation kind" };
    }
    const prompt = clampInput(input.prompt ?? "");
    if (!prompt) return { ok: false, error: "Describe what you want to generate" };

    const res = await runChat(
      buildGenerateMessages(kind as GenerateKind, {
        prompt,
        context: input.context,
      }),
    );
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AI generation failed",
    };
  }
}

/** §14.2 — writing assistant over existing document text. */
export async function improveTextAction(
  operation: string,
  text: string,
  extra?: { targetLanguage?: string },
): Promise<AiActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const gated = checkAiAccess(workspace);
    if (!gated.ok) return { ok: false, error: gated.error ?? "AI is plan-gated" };
    if (!ASSIST_OPERATIONS.has(operation)) {
      return { ok: false, error: "Unknown assistant operation" };
    }
    const source = clampInput(text ?? "");
    if (!source) return { ok: false, error: "There is no text to work on yet" };

    const res = await runChat(
      buildAssistantMessages(operation as AssistOperation, source, extra),
    );
    return res;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "AI assistant failed",
    };
  }
}
