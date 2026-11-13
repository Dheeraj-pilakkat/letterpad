import type { Metadata } from "next";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Admin · Users" };

interface AuthUser {
  _id: unknown;
  name?: string;
  email: string;
  createdAt?: Date | string;
}

export default async function AdminUsersPage() {
  const users = await getDb()
    .collection<AuthUser>("user")
    .find({})
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">
          {users.length} most recent accounts (max 200 shown).
        </p>
      </header>

      <div className="overflow-x-auto rounded-[4px] border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={String(u._id)} className="hover:bg-paper">
                <td className="px-4 py-2.5 font-medium text-ink">
                  {u.name || "—"}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{u.email}</td>
                <td className="px-4 py-2.5 text-muted">
                  {u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString("en-GB")
                    : "—"}
                </td>
                <td className="max-w-[160px] truncate px-4 py-2.5 font-mono text-xs text-muted">
                  {String(u._id)}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-muted">
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
