"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/card";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextName = String(form.get("name") ?? "").trim();
    setError(null);
    setSaved(false);
    if (!nextName) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.updateUser({ name: nextName });
      if (error) {
        setError(error.message ?? "Could not update profile");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name">
        <Input name="name" defaultValue={name} required autoComplete="name" />
      </Field>
      <Field label="Email" hint="Email is used to sign in and cannot be changed yet">
        <Input value={email} disabled readOnly autoComplete="email" />
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-forest" role="status">
          Profile saved.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Save profile
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    setError(null);
    setSaved(false);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      return;
    }
    startTransition(async () => {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
      });
      if (error) {
        setError(error.message ?? "Could not change password");
        return;
      }
      setSaved(true);
      e.currentTarget.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Current password">
        <Input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <Field label="New password" hint="At least 8 characters">
        <Input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </Field>
      {error ? (
        <p className="text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-forest" role="status">
          Password updated.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Spinner /> : null}
        Change password
      </Button>
    </form>
  );
}
