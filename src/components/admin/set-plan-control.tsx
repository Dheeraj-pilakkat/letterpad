"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlanAction } from "@/lib/actions/admin";
import { PLAN_IDS } from "@/lib/plans";
import type { PlanId } from "@/lib/db/types";

/** Admin control to set a workspace's plan manually (§21). */
export function SetPlanControl({
  workspaceId,
  currentPlan,
}: {
  workspaceId: string;
  currentPlan: PlanId;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply(next: string) {
    if (next === currentPlan) return;
    setError(null);
    startTransition(async () => {
      const res = await setPlanAction(workspaceId, next);
      if (!res.ok) {
        setError(res.error ?? "Failed to set plan");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        className="h-8 rounded-[3px] border border-line bg-white px-2 text-xs text-ink"
        value={currentPlan}
        disabled={pending}
        onChange={(e) => apply(e.target.value)}
        aria-label="Set plan"
      >
        {PLAN_IDS.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
