"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { expenseCalc } from "@/lib/finance";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/schemas";

export type ActionResult = { ok: boolean; error?: string; id?: string };

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const parsed = expenseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid expense",
      };
    }
    const d = parsed.data;
    const { taxAmount, total } = expenseCalc(d.amount, d.taxRate);

    const result = await collections.expenses().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      date: d.date,
      category: d.category,
      vendor: d.vendor || undefined,
      description: d.description,
      amount: d.amount,
      taxRate: d.taxRate,
      taxAmount,
      total,
      receipt: d.receipt || undefined,
      notes: d.notes || undefined,
      createdAt: new Date(),
    });

    revalidatePath("/app/expenses");
    revalidatePath("/app/finance");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to add expense",
    };
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid expense id" };

    const result = await collections
      .expenses()
      .deleteOne({ _id: objectId, workspaceId: workspace._id });
    if (result.deletedCount === 0) return { ok: false, error: "Expense not found" };

    revalidatePath("/app/expenses");
    revalidatePath("/app/finance");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to delete expense",
    };
  }
}
