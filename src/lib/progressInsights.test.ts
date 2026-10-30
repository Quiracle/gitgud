import { describe, expect, it } from "vitest";
import type { CompletionRecord } from "../storage/progress";
import {
  achievements,
  featuredAchievements,
  type Achievement,
  type AchievementId,
  chartSquares,
  chartStep,
  currentStreak,
  dailySolveDates,
  recentDailyTimes,
  recentDays,
} from "./progressInsights";

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

  it("counts a solve on the puzzle's Barcelona day once Barcelona time applies", () => {
    const lateNight = [
      solve("daily-2026-10-21", "2026-10-20T22:30:00Z"), // 00:30 on the 21st in Barcelona
      solve("daily-2026-10-21", "2026-10-21T22:30:00Z"), // already the 22nd in Barcelona
    ];
    expect([...dailySolveDates(lateNight)]).toEqual(["2026-10-21"]);
    expect([...dailySolveDates([lateNight[1]])]).toEqual([]);
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

describe("daily solve-time chart", () => {
  it("keeps the best unassisted daily time per day played, oldest first", () => {
    const days = recentDailyTimes(
      [
        solve("daily-2026-10-09", "2026-10-09T08:00:00Z", { elapsedMs: 90_000 }),
        solve("daily-2026-10-09", "2026-10-09T20:00:00Z", { elapsedMs: 60_000 }), // a faster retry
        solve("daily-2026-10-10", "2026-10-10T08:00:00Z", { elapsedMs: 5_000, assisted: true }),
        solve("daily-2026-10-10-v4", "2026-10-11T08:00:00Z", { elapsedMs: 40_000 }), // yesterday's, played today
        solve("daily-2026-10-11", "2026-10-11T09:00:00Z", { elapsedMs: 30_000 }),
        solve("lesson-switch", "2026-10-11T09:00:00Z", { elapsedMs: 1_000 }),
      ],
      "2026-10-11",
      3,
    );
    expect(days).toEqual([
      { date: "2026-10-09", elapsedMs: 60_000 },
      { date: "2026-10-10", elapsedMs: undefined },
      { date: "2026-10-11", elapsedMs: 30_000 },
    ]);
  });

  it("includes timed solves synced from other devices", () => {
    const phone = { kind: "daily" as const, puzzleId: "daily-2026-10-11", completedAt: "2026-10-11T07:00:00.000Z", elapsedMs: 45_000 };
    const untimed = { kind: "daily" as const, puzzleId: "daily-2026-10-10", completedAt: "2026-10-10T07:00:00.000Z" };
    expect(recentDailyTimes([solve("daily-2026-10-09", "2026-10-09T08:00:00Z"), phone, untimed], "2026-10-11", 3)).toEqual([
      { date: "2026-10-09", elapsedMs: 1_000 },
      { date: "2026-10-10", elapsedMs: undefined },
      { date: "2026-10-11", elapsedMs: 45_000 },
    ]);
  });

  it("picks a round step that fits the slowest solve", () => {
    expect(chartStep([], 8)).toBe(15_000);
    expect(chartStep([100_000], 8)).toBe(15_000);
    expect(chartStep([200_000, 30_000], 8)).toBe(30_000);
    expect(chartStep([7 * 60_000], 8)).toBe(60_000);
    expect(chartStep([20 * 3_600_000], 8)).toBe(3_600_000);
  });

  it("rounds each solve to whole squares within the chart", () => {
    expect(chartSquares(2_000, 60_000, 8)).toBe(1);
    expect(chartSquares(150_000, 60_000, 8)).toBe(3);
    expect(chartSquares(20 * 60_000, 60_000, 8)).toBe(8);
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
    expect(unlocked).toMatchObject({
      "first-solve": true,
      "clean-history": true,
      "daily-regular": true,
      "on-a-roll": true,
      "week-streak": false,
      "basics-graduate": false,
    });
  });

  it("dates each unlock to the solve that earned it, whatever order they were saved in", () => {
    const list = achievements(
      [
        solve("daily-2026-10-04", "2026-10-04T00:00:00Z"),
        solve("basics-01", "2026-10-01T00:00:00Z", { restartCount: 0 }),
        solve("daily-2026-10-02", "2026-10-02T00:00:00Z"),
        solve("daily-2026-10-03", "2026-10-03T00:00:00Z"),
      ],
      { lessonIds: ["basics-01"] },
    );
    const at = Object.fromEntries(list.map((item) => [item.id, item.unlockedAt]));
    expect(at["first-solve"]).toBe("2026-10-01T00:00:00Z");
    expect(at["basics-graduate"]).toBe("2026-10-01T00:00:00Z");
    expect(at["daily-regular"]).toBe("2026-10-02T00:00:00Z");
    expect(at["on-a-roll"]).toBe("2026-10-04T00:00:00Z");
    expect(at["week-streak"]).toBeUndefined();
  });

  it("unlocks the solve-quality achievements only without a revealed solution", () => {
    const fast = { elapsedMs: 10_000, commandCount: 2, restartCount: 4 };
    const unlockedBy = (records: CompletionRecord[]) =>
      achievements(records, { lessonIds: [] })
        .filter((item) => item.unlocked)
        .map((item) => item.id);
    expect(unlockedBy([solve("daily-2026-10-02", "2026-10-05T00:00:00Z", fast)])).toEqual(
      expect.arrayContaining(["quick-draw", "minimalist", "never-give-up", "time-traveler"]),
    );
    expect(unlockedBy([solve("daily-2026-10-02", "2026-10-05T00:00:00Z", { ...fast, assisted: true })])).toEqual([
      "first-solve",
    ]);
  });

  it("counts lessons, guided practice, and distinct puzzles", () => {
    const lessons = ["basics-01", "basics-02", "basics-03", "basics-04", "basics-05"].map((id, day) =>
      solve(id, `2026-10-0${day + 1}T00:00:00Z`),
    );
    const list = achievements([...lessons, solve("guided-git-revert", "2026-10-06T00:00:00Z", { kind: "generated" })], {
      lessonIds: [],
    });
    const unlocked = Object.fromEntries(list.map((item) => [item.id, item.unlocked]));
    expect(unlocked).toMatchObject({ "halfway-there": true, "curious-mind": true, "quarter-century": false });
  });
});

describe("featured achievements", () => {
  const item = (id: AchievementId, unlockedAt?: string): Achievement =>
    unlockedAt ? { id, unlocked: true, unlockedAt } : { id, unlocked: false };

  it("shows the latest unlocks first", () => {
    const list = [
      item("first-solve", "2026-10-01T00:00:00Z"),
      item("clean-history", "2026-10-03T00:00:00Z"),
      item("daily-regular", "2026-10-02T00:00:00Z"),
      item("on-a-roll"),
    ];
    expect(featuredAchievements(list, 2).map((entry) => entry.id)).toEqual(["clean-history", "daily-regular"]);
  });

  it("tops up with locked achievements in catalog order", () => {
    const list = [item("first-solve", "2026-10-01T00:00:00Z"), item("clean-history"), item("daily-regular"), item("on-a-roll")];
    expect(featuredAchievements(list, 3).map((entry) => entry.id)).toEqual(["first-solve", "clean-history", "daily-regular"]);
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

describe("dailySolveDates with a given-up daily", () => {
  it("does not count the day, while an earlier assisted solve still does", () => {
    const gaveUp = { kind: "daily" as const, puzzleId: "daily-2026-10-09", completedAt: "2026-10-09T12:00:00.000Z", assisted: true, gaveUp: true };
    const assisted = { kind: "daily" as const, puzzleId: "daily-2026-10-08", completedAt: "2026-10-08T12:00:00.000Z", assisted: true };
    expect([...dailySolveDates([gaveUp, assisted])]).toEqual(["2026-10-08"]);
  });
});
