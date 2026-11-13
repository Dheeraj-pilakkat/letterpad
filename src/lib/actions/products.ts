"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { productSchema } from "@/lib/validation/schemas";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function createProduct(input: unknown): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product",
      };
    }
    const now = new Date();
    const fields = clean(parsed.data);
    const result = await collections.products().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      kind: parsed.data.kind,
      name: parsed.data.name,
      unitPrice: parsed.data.unitPrice,
      taxRate: parsed.data.taxRate,
      active: parsed.data.active,
      ...fields,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath("/app/products");
    revalidatePath("/app/documents");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save product" };
  }
}

export async function updateProduct(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid product id" };
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid product",
      };
    }
    const fields = clean(parsed.data);
    const result = await collections.products().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      { $set: { ...fields, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Product not found" };
    revalidatePath("/app/products");
    revalidatePath("/app/documents");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save product" };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid product id" };
    const result = await collections.products().deleteOne({
      _id: objectId,
      workspaceId: workspace._id,
    });
    if (result.deletedCount === 0) return { ok: false, error: "Product not found" };
    revalidatePath("/app/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete product" };
  }
}

/** Lightweight payload for the document editor's catalogue picker. */
export type CatalogueItem = {
  id: string;
  name: string;
  unitPrice: number;
  taxRate: number;
};

export async function getCatalogueItems(): Promise<CatalogueItem[]> {
  const { workspace } = await requireWorkspace();
  const rows = await collections
    .products()
    .find({ workspaceId: workspace._id, active: true })
    .sort({ name: 1 })
    .limit(300)
    .toArray();
  return rows.map((row) => ({
    id: row._id.toHexString(),
    name: row.name,
    unitPrice: row.unitPrice,
    taxRate: row.taxRate,
  }));
}
