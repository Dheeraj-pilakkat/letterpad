/** Shared FormData → object helpers used by workspace and profile actions. */

export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

/** Brand colours arrive as a JSON array in a hidden field. */
export function parseBrandColors(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string")
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Numbering maps arrive as flat form fields:
 *   numberPrefix.invoice=INV  numberStart.invoice=100
 */
export function parseNumberMap(
  raw: unknown,
  numeric = false,
): Partial<Record<string, string | number>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const map = raw as Record<string, unknown>;
  const out: Partial<Record<string, string | number>> = {};
  const types = [
    "letter",
    "quote",
    "invoice",
    "receipt",
    "request",
    "creditNote",
    "debitNote",
  ] as const;
  for (const type of types) {
    const prefix = map[`numberPrefix.${type}`];
    const start = map[`numberStart.${type}`];
    if (numeric) {
      if (start !== undefined && start !== "") {
        const n = Number(start);
        if (Number.isFinite(n)) out[type] = n;
      }
    } else if (typeof prefix === "string" && prefix.trim()) {
      out[type] = prefix.trim();
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
