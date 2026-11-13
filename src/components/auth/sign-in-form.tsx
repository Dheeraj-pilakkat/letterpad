"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const { error } = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (error) {
        setError(error.message ?? "Could not sign in");
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="email" placeholder="you@business.com" />
      </Field>
      <Field label="Password">
        <div className="relative">
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="pr-20"
          />
          <Link
            href="/forgot-password"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-royal hover:underline"
          >
            Forgot?
          </Link>
        </div>
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">{error}</p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Spinner /> : null}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link className="text-royal underline underline-offset-2 hover:text-royal-soft" href="/sign-up">
          Create an account
        </Link>
      </p>
    </form>
  );
}
