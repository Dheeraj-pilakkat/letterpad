import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { collections } from "@/lib/db/client";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectCard, type LinkableDoc } from "@/components/projects/project-card";
import { EmptyState } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Projects" };

const STATUS_FILTERS = [
  ["", "All"],
  ["active", "Active"],
  ["planned", "Planned"],
  ["completed", "Completed"],
] as const;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { q, status } = await searchParams;

  const filter: Record<string, unknown> = { workspaceId: workspace._id };
  if (q?.trim()) {
    const re = { $regex: q.trim(), $options: "i" };
    filter.$or = [{ name: re }, { description: re }];
  }
  if (status) filter.status = status;

  const [projects, contacts, docs] = await Promise.all([
    collections
      .projects()
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
    collections
      .contacts()
      .find({ workspaceId: workspace._id, archived: false })
      .sort({ name: 1 })
      .limit(300)
      .toArray(),
    collections
      .documents()
      .find({ workspaceId: workspace._id, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  const contactNames = new Map(contacts.map((c) => [c._id.toHexString(), c.name]));
  const contactOptions = contacts.map((c) => ({
    id: c._id.toHexString(),
    name: c.name,
  }));
  const documents: LinkableDoc[] = docs.map((d) => ({
    id: d._id.toHexString(),
    label: `${d.number}${d.title ? ` · ${d.title}` : ""}`,
    projectId: d.projectId ? d.projectId.toHexString() : null,
  }));

  function hrefWith(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged = { q, status, ...params };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `/app/projects?${s}` : "/app/projects";
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Group milestones and documents around the work you do for each client.
          </p>
        </div>
        <ProjectDialog contacts={contactOptions} />
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(([value, label]) => (
          <a
            key={value}
            href={hrefWith({ status: value || undefined })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              (status ?? "") === value
                ? "border-ink bg-ink text-paper"
                : "border-line bg-white text-muted hover:border-ink/40",
            )}
          >
            {label}
          </a>
        ))}
        <form className="ml-auto w-full sm:w-auto" action="/app/projects" method="get">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search projects…"
            className="h-9 w-full rounded-[3px] border border-line bg-white px-3 text-xs text-ink placeholder:text-muted/60 focus:border-royal focus:outline-none sm:w-64"
          />
        </form>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title={q || status ? "No matches" : "No projects yet"}
          description={
            q || status
              ? "Try a different search or filter."
              : "Create a project to track milestones and keep every related document together."
          }
          action={
            q || status ? (
              <a
                href={hrefWith({ q: undefined, status: undefined })}
                className="inline-flex h-9 items-center rounded-[3px] border border-line bg-white px-4 text-sm text-ink"
              >
                Clear filters
              </a>
            ) : (
              <ProjectDialog contacts={contactOptions} triggerLabel="+ Create your first project" />
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <ProjectCard
              key={p._id.toHexString()}
              project={{
                id: p._id.toHexString(),
                name: p.name,
                description: p.description,
                contactId: p.contactId ? p.contactId.toHexString() : undefined,
                status: p.status,
                startDate: p.startDate,
                endDate: p.endDate,
                milestones: p.milestones.map((m) => ({
                  id: m.id,
                  title: m.title,
                  dueDate: m.dueDate,
                  done: m.done,
                })),
                clientName: p.contactId
                  ? contactNames.get(p.contactId.toHexString())
                  : undefined,
              }}
              contacts={contactOptions}
              documents={documents}
            />
          ))}
        </div>
      )}
    </div>
  );
}
