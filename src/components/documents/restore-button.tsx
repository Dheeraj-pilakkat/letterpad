"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreDocument } from "@/lib/actions/documents";
import { Button } from "@/components/ui/button";

export function RestoreDocumentButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreDocument(id);
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? "Restoring…" : "Restore"}
    </Button>
  );
}
