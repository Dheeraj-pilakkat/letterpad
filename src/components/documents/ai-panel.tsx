"use client";

import { useState, useTransition } from "react";
import { Sparkles, Wand2, Check, Copy } from "lucide-react";
import { generateTextAction, improveTextAction } from "@/lib/actions/ai";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

type Slot = "subject" | "body" | "terms";

const GENERATE_KINDS: Array<[string, string]> = [
  ["letter", "Business letter"],
  ["quote_description", "Quotation description"],
  ["proposal", "Project proposal"],
  ["payment_request", "Payment request"],
  ["agreement", "Service agreement draft"],
  ["followup", "Follow-up email"],
  ["client_message", "Client message"],
];

const ASSIST_OPERATIONS: Array<[string, string]> = [
  ["grammar", "Fix grammar & spelling"],
  ["rewrite", "Rewrite professionally"],
  ["formal", "Make more formal"],
  ["concise", "Make more concise"],
  ["improve_description", "Improve description"],
  ["terms", "Suggest terms & conditions"],
  ["title", "Generate document title"],
  ["translate", "Translate"],
];

const SLOT_LABELS: Array<[Slot, string]> = [
  ["subject", "Subject"],
  ["body", "Body"],
  ["terms", "Terms & notes"],
];

/**
 * §14.1/§14.2 — AI document generation + writing assistant.
 * Everything is a draft: the user reviews and applies it explicitly.
 */
export function AiPanel({
  docType,
  subject,
  body,
  terms,
  context,
  onApply,
}: {
  docType: string;
  subject: string;
  body: string;
  terms: string;
  context: string;
  onApply: (slot: Slot, text: string) => void;
}) {
  const [mode, setMode] = useState<"generate" | "improve">("generate");
  const [kind, setKind] = useState("letter");
  const [operation, setOperation] = useState("rewrite");
  const [slot, setSlot] = useState<Slot>("body");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = slot === "subject" ? subject : slot === "body" ? body : terms;

  function run() {
    setError(null);
    setResult(null);
    const source = current.trim() || prompt.trim();
    startTransition(async () => {
      const res =
        mode === "generate"
          ? await generateTextAction(kind, {
              prompt,
              context: [context, current ? `Existing text:\n${current}` : ""]
                .filter(Boolean)
                .join("\n\n"),
            })
          : await improveTextAction(operation, source, {
              targetLanguage: language || undefined,
            });
      if (!res.ok || !res.text) {
        setError(res.error ?? "AI returned no text");
        return;
      }
      setResult(res.text);
    });
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const source = current.trim() || prompt.trim();
  const needsInput = mode === "generate" ? prompt.trim().length === 0 : source.length === 0;

  return (
    <section className="rounded-[4px] border border-line bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Sparkles size={14} className="text-royal" /> AI assistant
        </h2>
        <div className="flex rounded-[3px] border border-line p-0.5" role="group" aria-label="AI mode">
          {(
            [
              ["generate", "Generate"],
              ["improve", "Improve"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={mode === key}
              onClick={() => {
                setMode(key);
                setResult(null);
                setError(null);
              }}
              className={
                mode === key
                  ? "rounded-[2px] bg-ink px-2.5 py-1 text-xs font-medium text-paper"
                  : "rounded-[2px] px-2.5 py-1 text-xs text-muted hover:text-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mode === "generate" ? (
          <Field label="What to write">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              {GENERATE_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Operation">
            <Select value={operation} onChange={(e) => setOperation(e.target.value)}>
              {ASSIST_OPERATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Apply result to">
          <Select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>
            {SLOT_LABELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {operation === "translate" && mode === "improve" ? (
        <div className="mt-3">
          <Field label="Target language">
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Hindi, Spanish"
            />
          </Field>
        </div>
      ) : null}

      {mode === "generate" ? (
        <div className="mt-3">
          <Field
            label="Describe the draft"
            hint="Include the key facts — who it's for, what happened, what you want"
          >
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={
                docType === "quote"
                  ? "Quote a website redesign for Blue Fern: 5 pages, copywriting included, 4-week timeline"
                  : "Remind Blue Fern that invoice INV-0042 of 1,200 USD is 10 days overdue"
              }
            />
          </Field>
        </div>
      ) : !current.trim() ? (
        <div className="mt-3">
          <Field label="Source text or instructions" hint="This slot is empty — type what to work from">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Paste or describe the text to improve"
            />
          </Field>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">
          Works on the current{" "}
          <strong>{SLOT_LABELS.find(([s]) => s === slot)?.[1].toLowerCase()}</strong> text (
          {current.trim().length} characters).
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={run} disabled={pending || needsInput}>
          {pending ? <Spinner /> : mode === "generate" ? <Wand2 size={14} /> : <Sparkles size={14} />}
          {mode === "generate" ? "Generate draft" : "Improve text"}
        </Button>
        <span className="text-xs text-muted">
          AI drafts are starting points — review before sending.
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-[3px] bg-red/10 px-3 py-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 rounded-[3px] border border-line bg-paper p-3">
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={7}
            aria-label="AI result"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                onApply(slot, result);
                setResult(null);
              }}
            >
              <Check size={14} /> Use as {SLOT_LABELS.find(([s]) => s === slot)?.[1].toLowerCase()}
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
