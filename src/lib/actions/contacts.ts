"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { contactSchema } from "@/lib/validation/schemas";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function createContact(input: unknown): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid contact",
      };
    }
    const now = new Date();
    const fields = clean(parsed.data);
    const result = await collections.contacts().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      ...fields,
      name: fields.name ?? parsed.data.name,
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath("/app/contacts");
    revalidatePath("/app/documents");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save contact" };
  }
}

export async function updateContact(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid contact id" };
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid contact",
      };
    }
    await collections
      .contacts()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { ...clean(parsed.data), updatedAt: new Date() } },
      );
    revalidatePath("/app/contacts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update contact" };
  }
}

export async function archiveContact(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid contact id" };
    await collections
      .contacts()
      .updateOne(
        { _id: objectId, workspaceId: workspace._id },
        { $set: { archived: true, updatedAt: new Date() } },
      );
    revalidatePath("/app/contacts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to archive contact" };
  }
}
