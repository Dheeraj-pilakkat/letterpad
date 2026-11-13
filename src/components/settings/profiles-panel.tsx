"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createProfileAction,
  deleteProfileAction,
  switchProfileAction,
  updateProfileAction,
} from "@/lib/actions/profiles";
import { CompanyForm } from "@/components/workspace/company-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import type { Workspace } from "@/lib/db/types";

type ProfileDTO = Omit<
  Workspace,
  "_id" | "createdAt" | "updatedAt" | "ownerUserId" | "slug"
>;

export interface ProfileRow {
  id: string;
  name: string;
  currency: string;
  profile: ProfileDTO;
}

/**
 * Settings → Business profiles (§6): create, edit, switch and delete the
 * additional business identities of a workspace. Owner/admin only — the
 * page itself is gated by `requireManager`.
 */
export function ProfilesPanel({
  profiles,
  activeId,
}: {
  profiles: ProfileRow[];
  activeId: string;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    setError(null);
    startTransition(async () => {
      const res = await createProfileAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed to create profile");
        return;
      }
      setNewName("");
      setEditingId(res.id ?? null);
      router.refresh();
    });
  }

  function activate(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await switchProfileAction(id);
      if (!res.ok) {
        setError(res.error ?? "Failed to switch profile");
        return;
      }
      router.refresh();
    });
  }

  function remove(p: ProfileRow) {
    if (!confirm(`Delete the “${p.name}” profile? Existing documents keep their numbers.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await deleteProfileAction(p.id);
      if (!res.ok) {
        setError(res.error ?? "Failed to delete profile");
        return;
      }
      if (editingId === p.id) setEditingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[4px] border border-line bg-white p-4">
        <h2 className="text-sm font-medium text-ink">New profile</h2>
        <p className="mt-1 text-xs text-muted">
          Starts as a copy of your current letterhead — edit it after creation.
          Each profile keeps its own branding and document-number sequence.
        </p>
        <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="Profile name" className="min-w-56 flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="US entity, Consulting, Retail…"
              maxLength={120}
              required
            />
          </Field>
          <Button type="submit" disabled={pending || !newName.trim()}>
            {pending ? <Spinner /> : <Plus size={14} />}
            Create profile
          </Button>
        </form>
      </section>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted">
          No business profiles yet. Documents are issued under your main
          letterhead until you create one.
        </p>
      ) : (
        <ul className="space-y-3">
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            const isEditing = editingId === p.id;
            return (
              <li key={p.id} className="rounded-[4px] border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      {p.name}
                      {isActive ? (
                        <span className="rounded-full bg-royal/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-royal">
                          Active
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{p.currency}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!isActive ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => activate(p.id)}
                        disabled={pending}
                      >
                        Use
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(isEditing ? null : p.id)}
                    >
                      {isEditing ? <X size={14} /> : <Pencil size={14} />}
                      {isEditing ? "Close" : "Edit"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(p)}
                      disabled={pending}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                {isEditing ? (
                  <div className="border-t border-line p-4">
                    <CompanyForm
                      key={p.id}
                      workspace={p.profile}
                      submit={(fd) => updateProfileAction(p.id, fd)}
                      submitLabel="Save profile"
                      flashMessage="Saved — documents under this profile use these details."
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}

      <p className="flex items-start gap-1.5 text-xs text-muted">
        <Check size={12} className="mt-0.5 shrink-0" />
        Switch profiles from the sidebar. New documents, recurring schedules
        and converted quotes inherit the active profile; the main letterhead
        (Settings → Business) stays as the default.
      </p>
    </div>
  );
}
