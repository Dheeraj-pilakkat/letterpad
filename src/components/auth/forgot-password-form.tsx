"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { authClient } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.requestPasswordReset({
        email: String(form.get("email") ?? ""),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message ?? "Could not send reset link");
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink">
          If that email is registered, a reset link is on its way.
        </p>
        <p className="text-xs text-muted">
          Check your inbox (and spam). The link expires in one hour.
        </p>
        <Link className="text-sm text-royal underline underline-offset-2" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@business.com"
        />
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        Send reset link
      </Button>
      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link className="text-royal underline underline-offset-2 hover:text-royal-soft" href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}
