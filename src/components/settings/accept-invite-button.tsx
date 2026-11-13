"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInviteAction(token);
      if (!res.ok) {
        setError(res.error ?? "Failed to accept invitation");
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div>
      <Button type="button" onClick={accept} disabled={pending}>
        {pending ? <Spinner /> : null} Accept invitation
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
