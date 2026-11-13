"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import { NOTIFICATION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface BellNotification {
  id: string;
  type: keyof typeof NOTIFICATION_LABELS;
  title: string;
  body?: string;
  href?: string;
  readAt: string | null;
  createdAt: string;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell({
  items,
  unread,
  className,
}: {
  items: BellNotification[];
  unread: number;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the dropdown.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function openItem(n: BellNotification) {
    setOpen(false);
    if (!n.readAt) {
      await markNotificationRead(n.id);
      router.refresh();
    }
    if (n.href) router.push(n.href);
  }

  async function markAll() {
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread > 0 ? `Notifications (${unread} unread)` : "Notifications"
        }
        aria-expanded={open}
        className="relative rounded-[3px] p-2 text-muted hover:bg-paper hover:text-ink"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[10px] font-semibold leading-none text-white"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-[4px] border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Notifications
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={markAll}
                className="flex items-center gap-1 text-xs text-royal hover:underline"
              >
                <Check size={12} strokeWidth={2} /> Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">
                You&apos;re all caught up.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-paper",
                    !n.readAt && "bg-royal/5",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.readAt ? "bg-line" : "bg-royal",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm text-ink",
                        !n.readAt && "font-medium",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {NOTIFICATION_LABELS[n.type]} · {formatWhen(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-line px-3 py-2">
            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className="text-xs text-royal hover:underline"
            >
              Go to overview
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
