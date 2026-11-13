"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  runSchedule,
  setScheduleStatus,
} from "@/lib/actions/schedules";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/card";
import type { ScheduleStatus } from "@/lib/db/types";

export function ScheduleActions({
  id,
  status,
  lastDocumentId,
}: {
  id: string;
  status: ScheduleStatus;
  lastDocumentId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      await runSchedule(id);
      router.refresh();
    });
  }

  function setStatus(next: ScheduleStatus) {
    startTransition(async () => {
      await setScheduleStatus(id, next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={pending || status !== "active"}
        onClick={run}
      >
        {pending ? <Spinner /> : null}
        Run now
      </Button>
      {status === "active" ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setStatus("paused")}>
          Pause
        </Button>
      ) : null}
      {status === "paused" ? (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setStatus("active")}>
          Resume
        </Button>
      ) : null}
      {status !== "completed" ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setStatus("completed")}>
          Complete
        </Button>
      ) : null}
      {lastDocumentId ? (
        <Link
          href={`/app/documents/${lastDocumentId}`}
          className="text-xs text-royal hover:underline"
        >
          Last document
        </Link>
      ) : null}
    </div>
  );
}
