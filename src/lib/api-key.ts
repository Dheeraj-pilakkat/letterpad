import { randomBytes } from "crypto";

/** Public API keys look like `lpk_<32 hex chars>` (§ public API). */
export function generateApiKey(): string {
  return `lpk_${randomBytes(16).toString("hex")}`;
}

export function isApiKey(value: unknown): value is string {
  return typeof value === "string" && /^lpk_[0-9a-f]{32}$/.test(value);
}

/** Show `lpk_abcd…wxyz` in the UI. */
export function maskApiKey(key: string): string {
  if (key.length <= 14) return key;
  return `${key.slice(0, 9)}…${key.slice(-4)}`;
}
