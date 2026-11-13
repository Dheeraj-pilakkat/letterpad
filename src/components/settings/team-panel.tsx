"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Mail, Shield, Trash2, UserMinus } from "lucide-react";
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
} from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "member";
  addedAt: string;
}

interface InviteRow {
  id: string;
  token: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  status: string;
}

export function TeamPanel({
  currentUserId,
  isOwner,
  owner,
  members,
  invites,
}: {
  currentUserId: string;
  isOwner: boolean;
  owner: { userId: string; name: string; email: string };
  members: MemberRow[];
  invites: InviteRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, onSuccess?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const clean = email.trim();
    if (!clean) return;
    setError(null);
    setNotice(null);
    setNewLink(null);
    startTransition(async () => {
      const res = await inviteMemberAction(clean, inviteRole);
      if (!res.ok) {
        setError(res.error ?? "Failed to invite");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setNewLink(`${origin}/invite/${res.token}`);
      setCopied(false);
      setNotice(
        res.emailed
          ? `Invitation sent to ${clean}.`
          : `Email delivery isn't configured — copy the link and share it with ${clean}.`,
      );
      setEmail("");
      router.refresh();
    });
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const roleBadge = (role: string) =>
    role === "admin" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-royal bg-royal/10 px-2 py-0.5 text-[11px] font-medium text-royal">
        <Shield size={10} /> Admin
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-medium text-muted">
        Member
      </span>
    );

  return (
    <div className="space-y-6">
      {/* invite form */}
      <section className="rounded-[4px] border border-line bg-white p-5">
        <h2 className="mb-1 text-sm font-medium text-ink">Invite a teammate</h2>
        <p className="mb-4 text-xs text-muted">
          They&apos;ll get access to documents in this workspace. Invitations expire
          after 7 days.
        </p>
        <form onSubmit={sendInvite} className="flex flex-wrap items-end gap-3">
          <Field label="Email address" className="min-w-56 flex-1">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          </Field>
          <Field label="Role">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
              aria-label="Role"
              className="h-9 rounded-[3px] border border-line bg-white px-2 text-sm text-ink focus:border-royal focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Button type="submit" disabled={pending || !email.trim()}>
            {pending ? <Spinner /> : <Mail size={14} />} Send invite
          </Button>
        </form>

        {notice ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[3px] border border-line bg-paper px-3 py-2 text-xs text-ink">
            <span>{notice}</span>
            {newLink ? (
              <button
                type="button"
                onClick={() => copyLink(newLink)}
                className="inline-flex items-center gap-1 rounded-[3px] border border-line bg-white px-2 py-1 text-xs text-royal hover:border-ink/40"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-red" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {/* members */}
      <section className="rounded-[4px] border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Members</h2>
        </div>
        <ul className="divide-y divide-line">
          <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {owner.name}
                <span className="ml-2 text-xs font-normal text-muted">(you)</span>
              </p>
              <p className="truncate text-xs text-muted">{owner.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-ink bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">
              <Shield size={10} /> Owner
            </span>
          </li>
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {m.name}
                  {m.userId === currentUserId ? (
                    <span className="ml-2 text-xs font-normal text-muted">(you)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {roleBadge(m.role)}
                {isOwner && m.userId !== currentUserId ? (
                  <>
                    <select
                      value={m.role}
                      disabled={pending}
                      aria-label={`Role for ${m.name}`}
                      onChange={(e) =>
                        run(() =>
                          updateMemberRoleAction(m.userId, e.target.value),
                        )
                      }
                      className="h-8 rounded-[3px] border border-line bg-white px-2 text-xs text-ink focus:border-royal focus:outline-none disabled:opacity-60"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${m.name}`}
                      onClick={() => {
                        if (confirm(`Remove ${m.name} from this workspace?`)) {
                          run(() => removeMemberAction(m.userId));
                        }
                      }}
                      className="rounded p-2 text-muted hover:text-red disabled:opacity-60"
                    >
                      <UserMinus size={14} />
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* pending invites */}
      <section className="rounded-[4px] border border-line bg-white">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-medium text-ink">Pending invitations</h2>
        </div>
        {invites.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No pending invitations.</p>
        ) : (
          <ul className="divide-y divide-line">
            {invites.map((i) => {
              const origin = typeof window !== "undefined" ? window.location.origin : "";
              const link = `${origin}/invite/${i.token}`;
              const expired = new Date().toISOString() > i.expiresAt;
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{i.email}</p>
                    <p className="text-xs text-muted">
                      {i.role === "admin" ? "Admin" : "Member"} ·{" "}
                      {expired ? "expired" : `expires ${i.expiresAt.slice(0, 10)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(link)}
                      className="inline-flex items-center gap-1 rounded-[3px] border border-line bg-white px-2.5 py-1.5 text-xs text-royal hover:border-ink/40"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />} Copy link
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => revokeInviteAction(i.id))}
                      className="inline-flex items-center gap-1 rounded-[3px] border border-line bg-white px-2.5 py-1.5 text-xs text-red hover:border-red-300 disabled:opacity-60"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className={cn("text-xs text-muted")}>
        Roles: <strong>owners</strong> and <strong>admins</strong> manage the
        team, business settings and payments. <strong>Members</strong> create and
        edit documents.
      </p>
    </div>
  );
}
