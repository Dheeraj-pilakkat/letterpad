import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

/** Comma-separated emails allowed into /admin (ADMIN_EMAILS env). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/** Gate for admin pages and actions: signed-in admin or redirect. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) {
    redirect("/app");
  }
  return user;
}
