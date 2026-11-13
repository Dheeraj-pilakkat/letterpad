import { describe, expect, it } from "vitest";
import {
  milestoneProgress,
  nextMilestoneDue,
  toggleMilestoneDone,
} from "@/lib/projects";
import type { ProjectMilestone } from "@/lib/db/types";

const list: ProjectMilestone[] = [
  { id: "a", title: "Kickoff", done: true, doneAt: new Date("2026-01-01") },
  { id: "b", title: "Draft", done: false, dueDate: "2026-02-01" },
  { id: "c", title: "Handoff", done: false, dueDate: "2026-01-15" },
];

describe("toggleMilestoneDone", () => {
  it("flips done and stamps doneAt when completing", () => {
    const now = new Date("2026-03-01");
    const next = toggleMilestoneDone(list, "b", now);
    expect(next[1].done).toBe(true);
    expect(next[1].doneAt).toEqual(now);
    // others untouched
    expect(next[0]).toBe(list[0]);
    expect(next[2]).toBe(list[2]);
  });

  it("clears doneAt when un-completing", () => {
    const next = toggleMilestoneDone(list, "a");
    expect(next[0].done).toBe(false);
    expect(next[0].doneAt).toBeUndefined();
  });

  it("ignores unknown ids", () => {
    expect(toggleMilestoneDone(list, "zzz")).toEqual(list);
  });
});

describe("milestoneProgress", () => {
  it("counts done and computes percent", () => {
    expect(milestoneProgress(list)).toEqual({ done: 1, total: 3, percent: 33.33 });
  });

  it("returns 0% for an empty list", () => {
    expect(milestoneProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("returns 100% when all done", () => {
    const all = list.map((m) => ({ ...m, done: true }));
    expect(milestoneProgress(all).percent).toBe(100);
  });
});

describe("nextMilestoneDue", () => {
  it("picks the earliest due date among unfinished milestones", () => {
    expect(nextMilestoneDue(list)).toBe("2026-01-15");
  });

  it("skips finished milestones and ones without dates", () => {
    const onlyDone: ProjectMilestone[] = [
      { id: "a", title: "Done", done: true, dueDate: "2026-01-01" },
      { id: "b", title: "No date", done: false },
    ];
    expect(nextMilestoneDue(onlyDone)).toBeUndefined();
  });
});
