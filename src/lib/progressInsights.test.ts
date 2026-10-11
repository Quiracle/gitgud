import { describe, expect, it } from "vitest";
import type { CompletionRecord } from "../storage/progress";
import { achievements, currentStreak, dailySolveDates, recentDays } from "./progressInsights";

function solve(puzzleId: string, completedAt: string, extra: Partial<CompletionRecord> = {}): CompletionRecord {
  return {
    id: `${puzzleId}-${completedAt}`,
    puzzleId,
    puzzleVersion: 1,
    kind: puzzleId.startsWith("daily-") ? "daily" : "lesson",
    startedAt: completedAt,
    completedAt,
    elapsedMs: 1000,
    restartCount: 1,
    commandCount: 2,
    commands: [],
    ranked: false,
    ...extra,
  };
}

describe("daily streaks", () => {
  const completions = [
    solve("daily-2026-10-07", "2026-10-07T09:00:00Z"),
    solve("daily-2026-10-08", "2026-10-08T21:00:00Z"),
    solve("daily-2026-10-09", "2026-10-09T08:00:00Z"),
    solve("daily-2026-10-09", "2026-10-09T10:00:00Z"), // same day twice counts once
    solve("daily-2026-10-05", "2026-10-09T11:00:00Z"), // archive replay doesn't count
  ];

  it("counts each daily once and ignores archive replays", () => {
    expect([...dailySolveDates(completions)].sort()).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
  });

  it("counts a corrected republication of the day's daily", () => {
    const republished = [solve("daily-2026-10-10-v2", "2026-10-10T13:00:00Z", { puzzleVersion: 2 })];
    expect([...dailySolveDates(republished)]).toEqual(["2026-10-10"]);
  });

  it("keeps the streak alive until today ends", () => {
    const dates = dailySolveDates(completions);
    expect(currentStreak(dates, "2026-10-09")).toBe(3);
    expect(currentStreak(dates, "2026-10-10")).toBe(3);
    expect(currentStreak(dates, "2026-10-11")).toBe(0);
  });

  it("lists recent days oldest first", () => {
    expect(recentDays(dailySolveDates(completions), "2026-10-10", 4)).toEqual([true, true, true, false]);
  });
});

describe("achievements", () => {
  it("unlocks from saved progress", () => {
    const list = achievements(
      [
        solve("basics-01", "2026-10-01T00:00:00Z", { restartCount: 0 }),
        solve("daily-2026-10-02", "2026-10-02T00:00:00Z"),
        solve("daily-2026-10-03", "2026-10-03T00:00:00Z"),
        solve("daily-2026-10-04", "2026-10-04T00:00:00Z"),
      ],
      { lessonIds: ["basics-01", "basics-02"] },
    );
    const unlocked = Object.fromEntries(list.map((item) => [item.id, item.unlocked]));
    expect(unlocked).toEqual({
      "first-solve": true,
      "clean-history": true,
      "daily-regular": true,
      "on-a-roll": true,
      "week-streak": false,
      "basics-graduate": false,
    });
  });
});

describe("solves synced from other devices", () => {
  const phone = { kind: "daily" as const, puzzleId: "daily-2026-10-11", completedAt: "2026-10-11T08:00:00.000Z" };

  it("extend the streak alongside this browser's solves", () => {
    const dates = dailySolveDates([solve("daily-2026-10-10", "2026-10-10T09:00:00Z"), phone]);
    expect(currentStreak(dates, "2026-10-11")).toBe(2);
    expect(recentDays(dates, "2026-10-11", 3)).toEqual([false, true, true]);
  });

  it("count towards achievements", () => {
    const list = achievements([], { lessonIds: ["basics-01"], syncedSolves: [phone] });
    const unlocked = Object.fromEntries(list.map((item) => [item.id, item.unlocked]));
    expect(unlocked["first-solve"]).toBe(true);
    expect(unlocked["daily-regular"]).toBe(true);
  });
});
