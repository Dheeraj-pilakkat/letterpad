"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { hasPlanFeature } from "@/lib/plans";
import {
  buildWebhookEvent,
  deliverWebhook,
  newWebhookSecret,
} from "@/lib/webhooks";

export type WebhookActionResult = { ok: boolean; error?: string };

function parseUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Save (or update) the outbound webhook endpoint. */
export async function saveWebhookAction(
  formData: FormData,
): Promise<WebhookActionResult> {
  try {
    const { workspace } = await requireManager();
    if (!hasPlanFeature(workspace, "webhooks")) {
      return { ok: false, error: "Outbound webhooks need the Starter plan or above" };
    }

    const url = parseUrl(String(formData.get("url") ?? ""));
    if (!url) return { ok: false, error: "Enter a valid http(s) URL" };
    const enabled = formData.get("enabled") === "on";

    const secret = workspace.webhook?.secret ?? newWebhookSecret();
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      {
        $set: {
          webhook: { url, secret, enabled, createdAt: workspace.webhook?.createdAt ?? new Date() },
          updatedAt: new Date(),
        },
      },
    );
    revalidatePath("/app/settings/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save webhook" };
  }
}

/** Send a `ping`-style document.created test event to the saved endpoint. */
export async function testWebhookAction(): Promise<WebhookActionResult> {
  try {
    const { workspace } = await requireManager();
    const cfg = workspace.webhook;
    if (!cfg?.url) return { ok: false, error: "Save an endpoint first" };
    if (!hasPlanFeature(workspace, "webhooks")) {
      return { ok: false, error: "Outbound webhooks need the Starter plan or above" };
    }
    const event = buildWebhookEvent({
      type: "document.created",
      workspaceId: workspace._id,
      data: { test: true, message: "Letterpad test event" },
    });
    const delivered = await deliverWebhook(cfg, event);
    return delivered
      ? { ok: true }
      : { ok: false, error: "Endpoint did not respond with 2xx" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Test failed" };
  }
}

/** Remove the webhook endpoint (and its signing secret). */
export async function removeWebhookAction(): Promise<WebhookActionResult> {
  try {
    const { workspace } = await requireManager();
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $unset: { webhook: "" }, $set: { updatedAt: new Date() } },
    );
    revalidatePath("/app/settings/integrations");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove webhook" };
  }
}
