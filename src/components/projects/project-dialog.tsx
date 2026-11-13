"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, deleteProject, updateProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export interface ProjectRow {
  id: string;
  name: string;
  description?: string;
  contactId?: string;
  status: "planned" | "active" | "on_hold" | "completed" | "cancelled";
  startDate?: string;
  endDate?: string;
}

const STATUSES = [
  ["planned", "Planned"],
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

export function ProjectDialog({
  project,
  contacts,
  triggerLabel = "+ New project",
  size = "primary",
}: {
  project?: ProjectRow;
  contacts: Array<{ id: string; name: string }>;
  triggerLabel?: string;
  size?: "primary" | "inline";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim(),
      contactId: String(fd.get("contactId") ?? ""),
      status: String(fd.get("status") ?? "planned"),
      startDate: String(fd.get("startDate") ?? ""),
      endDate: String(fd.get("endDate") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const res = project
        ? await updateProject(project.id, input)
        : await createProject(input);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    if (!project || !confirm(`Delete project "${project.name}"? Linked documents stay.`)) return;
    startTransition(async () => {
      const res = await deleteProject(project.id);
      if (!res.ok) {
        setError(res.error ?? "Failed to delete");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          project
            ? "text-sm font-medium text-royal hover:underline"
            : size === "primary"
              ? "inline-flex h-10 items-center rounded-[3px] bg-royal px-4 text-sm font-medium text-white hover:bg-royal-soft"
              : "inline-flex h-8 items-center rounded-[3px] border border-line bg-white px-3 text-xs text-ink hover:border-ink/40"
        }
      >
        {project ? project.name : triggerLabel}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[4px] border border-line bg-white p-6">
            <h2 className="mb-4 font-display text-xl text-ink">
              {project ? "Edit project" : "New project"}
            </h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <Field label="Project name">
                <Input name="name" required defaultValue={project?.name ?? ""} placeholder="Website redesign" />
              </Field>
              <Field label="Client">
                <select
                  name="contactId"
                  defaultValue={project?.contactId ?? ""}
                  className="h-9 w-full rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-royal focus:outline-none"
                >
                  <option value="">No client</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select
                    name="status"
                    defaultValue={project?.status ?? "planned"}
                    className="h-9 w-full rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-royal focus:outline-none"
                  >
                    {STATUSES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start date">
                  <Input name="startDate" type="date" defaultValue={project?.startDate ?? ""} />
                </Field>
                <Field label="End date">
                  <Input name="endDate" type="date" defaultValue={project?.endDate ?? ""} />
                </Field>
              </div>
              <Field label="Description">
                <Textarea
                  name="description"
                  rows={2}
                  defaultValue={project?.description ?? ""}
                  placeholder="Scope, goals, notes…"
                />
              </Field>
              {error ? (
                <p className="text-sm text-red" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between pt-2">
                <div>
                  {project ? (
                    <button
                      type="button"
                      onClick={remove}
                      className="text-sm text-red hover:underline"
                    >
                      Delete project
                    </button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? <Spinner /> : null}
                    Save project
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
