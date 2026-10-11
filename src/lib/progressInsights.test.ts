import { describe, expect, it } from "vitest";
import type { CompletionRecord } from "../storage/progress";
import {
  achievements,
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
  it("keeps the best unassisted time per daily date, oldest first", () => {
    const days = recentDailyTimes(
      [
        solve("daily-2026-10-09", "2026-10-09T08:00:00Z", { elapsedMs: 90_000 }),
        solve("daily-2026-10-09", "2026-10-10T08:00:00Z", { elapsedMs: 60_000 }), // a faster replay
        solve("daily-2026-10-10", "2026-10-10T08:00:00Z", { elapsedMs: 5_000, assisted: true }),
        solve("daily-2026-10-11-v2", "2026-10-11T08:00:00Z", { elapsedMs: 30_000 }),
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
