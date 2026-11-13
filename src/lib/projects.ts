import type { ProjectMilestone } from "@/lib/db/types";
import { round2 } from "@/lib/utils";

/** Flip a milestone's done flag (and stamp/clear doneAt). */
export function toggleMilestoneDone(
  milestones: ProjectMilestone[],
  id: string,
  now: Date = new Date(),
): ProjectMilestone[] {
  return milestones.map((m) =>
    m.id === id ? { ...m, done: !m.done, doneAt: !m.done ? now : undefined } : m,
  );
}

/** Completion stats for a milestone list. */
export function milestoneProgress(milestones: ProjectMilestone[]): {
  done: number;
  total: number;
  percent: number;
} {
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  return { done, total, percent: total === 0 ? 0 : round2((done / total) * 100) };
}

/** Next unfinished milestone due date, if any. */
export function nextMilestoneDue(
  milestones: ProjectMilestone[],
): string | undefined {
  return milestones
    .filter((m) => !m.done && m.dueDate)
    .map((m) => m.dueDate!)
    .sort()[0];
}
