"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";

export function RestoreContactButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreContact(id);
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
