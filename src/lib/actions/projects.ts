"use server";

import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import { requireWorkspace, toObjectId } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { projectSchema } from "@/lib/validation/schemas";
import { toggleMilestoneDone } from "@/lib/projects";

export type ActionResult = { ok: boolean; error?: string; id?: string };

function newMilestoneId(): string {
  return `ms-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export async function createProject(input: unknown): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid project",
      };
    }
    const data = parsed.data;
    const now = new Date();
    const contactId = data.contactId ? toObjectId(data.contactId) : null;
    const result = await collections.projects().insertOne({
      _id: new ObjectId(),
      workspaceId: workspace._id,
      contactId,
      name: data.name,
      description: data.description,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
      milestones: (data.milestones ?? []).map((m) => ({
        ...m,
        id: m.id || newMilestoneId(),
      })),
      documentIds: [],
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath("/app/projects");
    return { ok: true, id: result.insertedId.toHexString() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save project" };
  }
}

export async function updateProject(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid project id" };
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid project",
      };
    }
    const data = parsed.data;
    const fields = clean({
      name: data.name,
      description: data.description,
      status: data.status,
      startDate: data.startDate,
      endDate: data.endDate,
    });
    const result = await collections.projects().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      {
        $set: {
          ...fields,
          contactId: data.contactId ? toObjectId(data.contactId) : null,
          ...(data.milestones
            ? {
                milestones: data.milestones.map((m) => ({
                  ...m,
                  id: m.id || newMilestoneId(),
                })),
              }
            : {}),
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Project not found" };
    revalidatePath("/app/projects");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save project" };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(id);
    if (!objectId) return { ok: false, error: "Invalid project id" };
    const result = await collections.projects().deleteOne({
      _id: objectId,
      workspaceId: workspace._id,
    });
    if (result.deletedCount === 0) return { ok: false, error: "Project not found" };
    await collections
      .documents()
      .updateMany(
        { workspaceId: workspace._id, projectId: objectId },
        { $set: { projectId: null } },
      );
    revalidatePath("/app/projects");
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete project" };
  }
}

/** Add a milestone, or toggle/untoggle one when `toggleId` is given. */
export async function saveMilestones(
  projectId: string,
  milestones: unknown[],
  toggleId?: string,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const objectId = toObjectId(projectId);
    if (!objectId) return { ok: false, error: "Invalid project id" };

    const parsed = projectSchema.shape.milestones.safeParse(milestones);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid milestones",
      };
    }
    let list = parsed.data ?? [];
    if (toggleId) list = toggleMilestoneDone(list, toggleId);

    const result = await collections.projects().updateOne(
      { _id: objectId, workspaceId: workspace._id },
      { $set: { milestones: list, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Project not found" };
    revalidatePath("/app/projects");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save milestones" };
  }
}

/** Attach (projectId=null detaches) a document to a project. */
export async function setDocumentProject(
  documentId: string,
  projectId: string | null,
): Promise<ActionResult> {
  try {
    const { workspace } = await requireWorkspace();
    const docId = toObjectId(documentId);
    if (!docId) return { ok: false, error: "Invalid document id" };
    let projectRef: ObjectId | null = null;
    if (projectId) {
      projectRef = toObjectId(projectId);
      if (!projectRef) return { ok: false, error: "Invalid project id" };
      const project = await collections.projects().findOne({
        _id: projectRef,
        workspaceId: workspace._id,
      });
      if (!project) return { ok: false, error: "Project not found" };
    }
    const result = await collections.documents().updateOne(
      { _id: docId, workspaceId: workspace._id },
      { $set: { projectId: projectRef, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) return { ok: false, error: "Document not found" };
    revalidatePath("/app/projects");
    revalidatePath("/app/documents");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to link document" };
  }
}
