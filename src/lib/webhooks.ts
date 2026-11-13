/**
 * Outbound webhooks (§ third-party integrations, plan-gated to Starter+).
 * Payloads are signed with HMAC-SHA256 over the raw JSON body and sent as
 * `X-Letterpad-Signature` (hex). Delivery is best-effort with a 5s timeout.
 */

import { createHmac, randomBytes } from "crypto";
import type { ObjectId } from "mongodb";
import { collections } from "@/lib/db/client";
import type { WebhookConfig } from "@/lib/db/types";
import { hasPlanFeature } from "@/lib/plans";

export type WebhookEventType =
  | "document.created"
  | "document.status_changed";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  createdAt: string;
  workspaceId: string;
  data: Record<string, unknown>;
}

export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function newWebhookSecret(): string {
  return `whsec_${randomBytes(16).toString("hex")}`;
}

export function buildWebhookEvent(input: {
  type: WebhookEventType;
  workspaceId: ObjectId;
  data: Record<string, unknown>;
}): WebhookEvent {
  return {
    id: randomBytes(8).toString("hex"),
    type: input.type,
    createdAt: new Date().toISOString(),
    workspaceId: input.workspaceId.toHexString(),
    data: input.data,
  };
}

/** POST the event to the configured URL. Returns true on 2xx. */
export async function deliverWebhook(
  config: WebhookConfig,
  event: WebhookEvent,
): Promise<boolean> {
  if (!config.enabled || !config.url || !config.secret) return false;
  const payload = JSON.stringify(event);
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-letterpad-signature": signWebhookPayload(payload, config.secret),
        "x-letterpad-event": event.type,
        "x-letterpad-delivery": event.id,
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fire an event if the workspace has webhooks configured and the plan
 * allows them. Best-effort: never throws, never blocks the caller.
 */
export async function fireWebhook(
  workspaceId: ObjectId,
  type: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const workspace = await collections
      .workspaces()
      .findOne({ _id: workspaceId });
    if (!workspace?.webhook?.enabled) return;
    if (!hasPlanFeature(workspace, "webhooks")) return;
    const event = buildWebhookEvent({ type, workspaceId, data });
    await deliverWebhook(workspace.webhook, event);
  } catch {
    // Swallow — webhook delivery must never break the main flow.
  }
}

/** Fire-and-forget wrapper for use inside actions. */
export function queueWebhook(
  workspaceId: ObjectId,
  type: WebhookEventType,
  data: Record<string, unknown>,
): void {
  void fireWebhook(workspaceId, type, data);
}
