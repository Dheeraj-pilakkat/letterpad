"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { switchProfileAction } from "@/lib/actions/profiles";
import { Spinner } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProfileOption {
  id: string;
  name: string;
}

/**
 * Dropdown to switch the active business profile (§6). Empty string (""
 * option) returns to the workspace default branding. Hidden by the sidebar
 * when the workspace has no profiles.
 */
export function ProfileSwitcher({
  profiles,
  currentId,
  compact = false,
}: {
  profiles: ProfileOption[];
  currentId: string; // "" = workspace default
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  if (profiles.length === 0) return null;

  const current =
    profiles.find((p) => p.id === currentId) ?? null;
  const label = current?.name ?? "Default profile";

  function pick(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await switchProfileAction(id);
      if (!res.ok) {
        setError(res.error ?? "Failed to switch");
        return;
      }
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
        aria-label={`Business profile: ${label}`}
        disabled={pending}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[3px] border border-line bg-white px-3 py-2 text-left transition-colors hover:border-ink/40 disabled:opacity-60",
          compact ? "text-xs" : "text-sm",
        )}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Building2 size={13} className="shrink-0 text-muted" />
          <span className="min-w-0 truncate font-medium text-ink">{label}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted" />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-40 mt-1 w-full min-w-52 rounded-[4px] border border-line bg-white p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => pick("")}
              disabled={pending}
              className="flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left text-sm text-ink hover:bg-paper disabled:opacity-60"
            >
              <span className="min-w-0 truncate">Default profile</span>
              {currentId === "" ? <Check size={12} className="text-royal" /> : null}
            </button>
            {profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() => pick(p.id)}
                disabled={pending}
                className="flex w-full items-center justify-between gap-2 rounded-[3px] px-2 py-1.5 text-left text-sm text-ink hover:bg-paper disabled:opacity-60"
              >
                <span className="min-w-0 truncate">{p.name}</span>
                {p.id === currentId ? <Check size={12} className="text-royal" /> : null}
              </button>
            ))}
            {error ? (
              <p className="px-2 py-1 text-xs text-red" role="alert">
                {error}
              </p>
            ) : null}
            {pending ? (
              <div className="flex justify-center px-2 py-1.5">
                <Spinner />
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
