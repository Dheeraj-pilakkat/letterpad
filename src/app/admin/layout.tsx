import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin" };

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line bg-ink text-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <p className="font-display text-lg">
              Letter<span className="text-royal-soft">pad</span>{" "}
              <span className="text-xs font-normal uppercase tracking-widest text-paper/60">
                Admin
              </span>
            </p>
            <nav className="flex flex-wrap gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[3px] px-2.5 py-1.5 text-sm text-paper/80 hover:bg-paper/10 hover:text-paper"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs text-paper/70">
            <span className="truncate">{user.email}</span>
            <Link
              href="/app"
              className="rounded-[3px] border border-paper/30 px-2.5 py-1.5 text-paper hover:bg-paper/10"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
