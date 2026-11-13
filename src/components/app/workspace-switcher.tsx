"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  createWorkspaceAction,
  switchWorkspaceAction,
} from "@/lib/actions/workspaces";
import { Spinner } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface WorkspaceOption {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
}

/** Dropdown to switch between workspaces or create a new one. */
export function WorkspaceSwitcher({
  workspaces,
  currentId,
  compact = false,
}: {
  workspaces: WorkspaceOption[];
  currentId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const current = workspaces.find((w) => w.id === currentId);

  function pick(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await switchWorkspaceAction(id);
      if (!res.ok) {
        setError(res.error ?? "Failed to switch");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await createWorkspaceAction(name);
      if (!res.ok) {
        setError(res.error ?? "Failed to create workspace");
        return;
      }
      setCreating(false);
      setNewName("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={pending}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[3px] border border-line bg-white px-3 py-2 text-left transition-colors hover:border-ink/40 disabled:opacity-60",
          compact ? "text-xs" : "text-sm",
        )}
      >
        <span className="min-w-0 truncate font-medium text-ink">
          {current?.name ?? "Workspace"}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => {
              setOpen(false);
              setCreating(false);
            }}
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-1 w-full min-w-52 rounded-[4px] border border-line bg-white p-1 shadow-lg"
          >
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                role="menuitem"
                onClick={() => pick(w.id)}
                disabled={pending}
                className="flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left text-sm text-ink hover:bg-paper disabled:opacity-60"
              >
                <span className="min-w-0 truncate">{w.name}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {w.role}
                  </span>
                  {w.id === currentId ? <Check size={12} className="text-royal" /> : null}
                </span>
              </button>
            ))}

            <div className="mt-1 border-t border-line pt-1">
              {creating ? (
                <div className="flex items-center gap-1.5 px-1 py-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        create();
                      }
                      if (e.key === "Escape") setCreating(false);
                    }}
                    placeholder="Workspace name"
                    maxLength={80}
                    aria-label="New workspace name"
                    className="h-8 min-w-0 flex-1 rounded-[3px] border border-line bg-white px-2 text-sm text-ink placeholder:text-ink-soft/50 focus:border-royal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={create}
                    disabled={pending || !newName.trim()}
                    className="flex h-8 items-center rounded-[3px] bg-royal px-2.5 text-xs font-medium text-white hover:bg-royal-soft disabled:opacity-50"
                  >
                    {pending ? <Spinner /> : "Create"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-sm text-muted hover:bg-paper hover:text-ink"
                >
                  <Plus size={14} /> New workspace
                </button>
              )}
              {error ? (
                <p className="px-2 py-1 text-xs text-red" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
