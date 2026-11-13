"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import {
  saveMilestones,
  setDocumentProject,
  updateProject,
} from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { milestoneProgress, nextMilestoneDue } from "@/lib/projects";
import { ProjectDialog, type ProjectRow } from "./project-dialog";

type Milestone = { id: string; title: string; dueDate?: string; done: boolean };

export interface ProjectCardData extends ProjectRow {
  milestones: Milestone[];
  clientName?: string;
}

export interface LinkableDoc {
  id: string;
  label: string;
  projectId?: string | null;
}

const STATUS_LABELS: Record<ProjectRow["status"], string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_STYLE: Record<ProjectRow["status"], string> = {
  planned: "border-line bg-white text-muted",
  active: "border-royal bg-royal/10 text-royal",
  on_hold: "border-amber-400 bg-amber-50 text-amber-700",
  completed: "border-emerald-500 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-300 bg-red-50 text-red",
};

export function ProjectCard({
  project,
  contacts,
  documents,
}: {
  project: ProjectCardData;
  contacts: Array<{ id: string; name: string }>;
  documents: LinkableDoc[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const progress = milestoneProgress(project.milestones);
  const due = nextMilestoneDue(project.milestones);
  const linkedDocs = documents.filter((d) => d.projectId === project.id);
  const linkable = documents.filter((d) => !d.projectId || d.projectId === project.id);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      router.refresh();
    });
  }

  function addMilestone() {
    const title = newTitle.trim();
    if (!title) return;
    const next: Milestone[] = [
      ...project.milestones,
      { id: `ms-${Date.now().toString(36)}`, title, dueDate: newDue || undefined, done: false },
    ];
    setNewTitle("");
    setNewDue("");
    run(() => saveMilestones(project.id, next));
  }

  return (
    <div className="rounded-[4px] border border-line bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectDialog
              project={project}
              contacts={contacts}
              triggerLabel={project.name}
              size="inline"
            />
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                STATUS_STYLE[project.status],
              )}
            >
              {STATUS_LABELS[project.status]}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted">
            {[project.clientName, project.description].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {progress.total > 0 ? (
            <span className="text-xs tabular-nums text-muted">
              {progress.done}/{progress.total} milestones
              {due ? ` · next due ${due}` : ""}
            </span>
          ) : null}
          <select
            value={project.status}
            aria-label={`Status of ${project.name}`}
            disabled={pending}
            onChange={(e) => {
              const status = e.target.value as ProjectRow["status"];
              run(() =>
                updateProject(project.id, {
                  name: project.name,
                  description: project.description,
                  contactId: project.contactId,
                  status,
                  startDate: project.startDate,
                  endDate: project.endDate,
                  milestones: project.milestones,
                }),
              );
            }}
            className="h-8 rounded-[3px] border border-line bg-white px-2 text-xs text-ink focus:border-royal focus:outline-none disabled:opacity-60"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 py-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Milestones
        </h3>
        {project.milestones.length === 0 ? (
          <p className="mb-2 text-sm text-muted">No milestones yet.</p>
        ) : (
          <ul className="mb-2 space-y-1">
            {project.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={pending}
                  aria-label={m.done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
                  onClick={() => run(() => saveMilestones(project.id, project.milestones, m.id))}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-[3px] border transition-colors disabled:opacity-60",
                    m.done
                      ? "border-royal bg-royal text-white"
                      : "border-line bg-white text-transparent hover:border-ink/40",
                  )}
                >
                  <Check size={12} strokeWidth={3} />
                </button>
                <span className={cn("min-w-0 flex-1 truncate", m.done && "text-muted line-through")}>
                  {m.title}
                </span>
                {m.dueDate ? (
                  <span className="text-xs tabular-nums text-muted">{m.dueDate}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMilestone();
              }
            }}
            placeholder="New milestone…"
            aria-label={`New milestone for ${project.name}`}
            className="h-8 w-52"
          />
          <Input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            aria-label={`Due date for new milestone`}
            className="h-8 w-40"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || !newTitle.trim()}
            onClick={addMilestone}
          >
            {pending ? <Spinner /> : <Plus size={14} />} Add
          </Button>
        </div>

        {error ? (
          <p className="mt-2 text-sm text-red" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 border-t border-line pt-3">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Linked documents
          </h3>
          {linkedDocs.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {linkedDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/app/documents/${d.id}`}
                    className="truncate text-royal hover:underline"
                  >
                    {d.label}
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Unlink ${d.label}`}
                    onClick={() => run(() => setDocumentProject(d.id, null))}
                    className="rounded p-1 text-muted hover:text-red disabled:opacity-60"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-2 text-sm text-muted">No documents linked yet.</p>
          )}
          <select
            value=""
            disabled={pending}
            aria-label={`Link a document to ${project.name}`}
            onChange={(e) => {
              const id = e.target.value;
              if (id) run(() => setDocumentProject(id, project.id));
            }}
            className="h-8 rounded-[3px] border border-line bg-white px-2 text-xs text-ink focus:border-royal focus:outline-none disabled:opacity-60"
          >
            <option value="">Link a document…</option>
            {linkable.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
