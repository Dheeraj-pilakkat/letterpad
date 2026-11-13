"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Palette,
  Package,
  Plus,
  Repeat,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { authClient } from "@/components/auth/auth-provider";
import { WorkspaceSwitcher, type WorkspaceOption } from "@/components/app/workspace-switcher";
import { ProfileSwitcher, type ProfileOption } from "@/components/app/profile-switcher";
import {
  NotificationBell,
  type BellNotification,
} from "@/components/app/notification-bell";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/contacts", label: "Contacts", icon: Users },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/finance", label: "Finance", icon: Wallet },
  { href: "/app/recurring", label: "Recurring", icon: Repeat },
  { href: "/app/templates", label: "Templates", icon: Palette },
  { href: "/app/company", label: "Letterhead", icon: Mail },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  workspaceName,
  userName,
  userEmail,
  workspaces,
  currentWorkspaceId,
  profiles = [],
  currentProfileId = "",
  notifications = [],
  unreadCount = 0,
  isAdmin = false,
}: {
  workspaceName: string;
  userName: string;
  userEmail: string;
  workspaces: WorkspaceOption[];
  currentWorkspaceId: string;
  profiles?: ProfileOption[];
  currentProfileId?: string;
  notifications?: BellNotification[];
  unreadCount?: number;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // close the drawer whenever the route changes (render-time adjustment,
  // per React docs — avoids setState-in-effect)
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  // Escape closes the drawer; body scroll locks while it is open
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  function navLink(href: string, label: string, Icon: typeof Menu) {
    const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={cn(
          "flex items-center gap-2.5 rounded-[3px] px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-paper-dim font-medium text-ink"
            : "text-muted hover:bg-paper hover:text-ink",
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={16} strokeWidth={1.75} />
        {label}
      </Link>
    );
  }

  const navItems = isAdmin
    ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : NAV;

  return (
    <>
      {/* ---------- mobile top bar ---------- */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-line bg-white px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
          className="rounded-[3px] p-2.5 text-ink hover:bg-paper"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <Link href="/app" className="shrink-0 font-display text-lg text-ink">
            Letter<span className="text-royal">pad</span>
          </Link>
          <span className="min-w-0 truncate text-xs text-muted" title={workspaceName}>
            {workspaceName}
          </span>
        </div>
        <NotificationBell items={notifications} unread={unreadCount} />
        <Link
          href="/app/documents/new"
          aria-label="New document"
          className="rounded-[3px] bg-royal p-2.5 text-white"
        >
          <Plus size={18} strokeWidth={2} />
        </Link>
      </header>

      {/* ---------- mobile drawer ---------- */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <div className="min-w-0 flex-1">
                <Link href="/app" className="font-display text-xl text-ink">
                  Letter<span className="text-royal">pad</span>
                </Link>
                <div className="mt-1.5">
                  <WorkspaceSwitcher
                    workspaces={workspaces}
                    currentId={currentWorkspaceId}
                    compact
                  />
                  {profiles.length > 0 ? (
                    <div className="mt-1.5">
                      <ProfileSwitcher
                        profiles={profiles}
                        currentId={currentProfileId}
                        compact
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-[3px] p-2.5 text-muted hover:text-ink"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              <Link
                href="/app/documents/new"
                onClick={() => setOpen(false)}
                className="mb-2 flex items-center justify-center gap-2 rounded-[3px] bg-royal px-3 py-2.5 text-sm font-medium text-white"
              >
                <Plus size={16} strokeWidth={2} /> New document
              </Link>
              {navItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
            </nav>

            <div className="border-t border-line p-4">
              <p className="truncate text-sm text-ink" title={userName}>
                {userName}
              </p>
              <p className="mb-3 truncate text-xs text-muted" title={userEmail}>
                {userEmail}
              </p>
              <button
                onClick={signOut}
                className="flex min-h-11 items-center gap-2 text-xs text-muted hover:text-red"
              >
                <LogOut size={14} strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------- desktop sidebar ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line px-5 py-5">
          <div className="flex items-center justify-between gap-2">
            <Link href="/app" className="font-display text-xl text-ink">
              Letter<span className="text-royal">pad</span>
            </Link>
            <NotificationBell items={notifications} unread={unreadCount} />
          </div>
          <div className="mt-2">
            <WorkspaceSwitcher workspaces={workspaces} currentId={currentWorkspaceId} />
            {profiles.length > 0 ? (
              <div className="mt-1.5">
                <ProfileSwitcher
                  profiles={profiles}
                  currentId={currentProfileId}
                />
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems.map(({ href, label, icon: Icon }) => navLink(href, label, Icon))}
        </nav>

        <div className="border-t border-line p-4">
          <p className="truncate text-sm text-ink" title={userName}>
            {userName}
          </p>
          <p className="mb-3 truncate text-xs text-muted" title={userEmail}>
            {userEmail}
          </p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-muted hover:text-red"
          >
            <LogOut size={14} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
