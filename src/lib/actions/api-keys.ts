"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { generateApiKey } from "@/lib/api-key";

export type ApiKeyResult = { ok: boolean; key?: string; error?: string };

/** Generate the workspace's public API key (only if one doesn't exist yet). */
export async function generateApiKeyAction(): Promise<ApiKeyResult> {
  try {
    const { workspace } = await requireManager();
    if (workspace.apiKey) {
      return { ok: false, error: "An API key already exists — rotate it instead" };
    }
    const key = generateApiKey();
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $set: { apiKey: key, updatedAt: new Date() } },
    );
    revalidatePath("/app/settings/api");
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not generate key" };
  }
}

/** Replace the API key with a fresh one (old key stops working immediately). */
export async function rotateApiKeyAction(): Promise<ApiKeyResult> {
  try {
    const { workspace } = await requireManager();
    if (!workspace.apiKey) {
      return { ok: false, error: "No API key to rotate — generate one first" };
    }
    const key = generateApiKey();
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $set: { apiKey: key, updatedAt: new Date() } },
    );
    revalidatePath("/app/settings/api");
    return { ok: true, key };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not rotate key" };
  }
}

/** Remove the API key entirely (revokes API access). */
export async function revokeApiKeyAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { workspace } = await requireManager();
    await collections.workspaces().updateOne(
      { _id: workspace._id },
      { $unset: { apiKey: "" }, $set: { updatedAt: new Date() } },
    );
    revalidatePath("/app/settings/api");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not revoke key" };
  }
}
