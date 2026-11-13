/**
 * Public API authentication (§ third-party integrations): Bearer/API-key
 * auth against Workspace.apiKey plus a fixed-window per-plan rate limit.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { collections } from "@/lib/db/client";
import type { Workspace } from "@/lib/db/types";
import { apiRateLimitFor } from "@/lib/plans";
import { isApiKey } from "@/lib/api-key";

export type ApiAuthResult =
  | { ok: true; workspace: Workspace }
  | { ok: false; status: 401 | 429 | 500; error: string };

/** Fixed-window limiter: `limit` requests per 60s window, per workspace. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/** Extract and validate the caller's API key. */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const token = bearer || (request.headers.get("x-api-key")?.trim() ?? "");

  if (!isApiKey(token)) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid API key (use Authorization: Bearer lpk_…)",
    };
  }

  let workspace: Workspace | null;
  try {
    workspace = await collections.workspaces().findOne({ apiKey: token });
  } catch {
    return { ok: false, status: 500, error: "Database unavailable" };
  }
  if (!workspace) {
    return { ok: false, status: 401, error: "Unknown API key" };
  }

  const limit = apiRateLimitFor(workspace);
  if (!rateLimit(workspace._id.toHexString(), limit)) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded (${limit} requests/minute on this plan)`,
    };
  }

  return { ok: true, workspace };
}

/** JSON error helper shared by /api/v1 routes. */
export function apiError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}
