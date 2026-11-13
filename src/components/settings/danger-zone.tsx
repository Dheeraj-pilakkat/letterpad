"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccountAction } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

/**
 * Settings → Danger zone: permanent account deletion with password
 * confirmation. Requires typing DELETE so it cannot happen by mis-click.
 */
export function DangerZone({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = confirmText === "DELETE" && password.length > 0 && !pending;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canDelete) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAccountAction(password);
      if (!res.ok) {
        setError(res.error ?? "Could not delete account");
        return;
      }
      router.replace("/sign-in");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[3px] border border-red/40 bg-red/5 p-3 text-sm text-ink">
        This permanently deletes your account, every workspace you own, and all
        documents, clients and payments in them. Members lose access to your
        workspaces. This cannot be undone — export your data first.
      </div>
      <Field label="Confirm" hint={'Type "DELETE" to enable the button'}>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          aria-label="Type DELETE to confirm"
        />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          aria-label="Your password"
        />
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="danger" disabled={!canDelete}>
        {pending ? <Spinner /> : null}
        Delete account for {email}
      </Button>
    </form>
  );
}
