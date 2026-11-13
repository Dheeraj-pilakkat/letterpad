"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function ResetPasswordForm({ initialToken }: { initialToken?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = initialToken || searchParams.get("token") || "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    setError(null);
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.resetPassword({
        newPassword,
        token,
      });
      if (error) {
        setError(error.message ?? "Could not reset password");
        return;
      }
      router.push("/sign-in");
      router.refresh();
    });
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-red" role="alert">
          Missing reset token. Request a new link.
        </p>
        <Link className="text-sm text-royal underline underline-offset-2" href="/forgot-password">
          Forgot password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="New password" hint="At least 8 characters">
        <Input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </Field>
      <Field label="Confirm password">
        <Input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        Set new password
      </Button>
    </form>
  );
}
