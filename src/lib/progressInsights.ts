import type { CompletionRecord } from "../storage/progress";

/** The parts of a solve that streaks need; synced solves from other devices carry only these. */
export type DailySolve = Pick<CompletionRecord, "kind" | "puzzleId" | "completedAt">;

/** UTC date (YYYY-MM-DD) of each official daily solved on its own day. */
export function dailySolveDates(completions: readonly DailySolve[]): Set<string> {
  const dates = new Set<string>();
  for (const completion of completions) {
    if (completion.kind !== "daily") continue;
    // Corrected republications get a version suffix: daily-2026-10-10-v2.
    const puzzleDate = /^daily-(\d{4}-\d{2}-\d{2})(?:-v\d+)?$/.exec(completion.puzzleId)?.[1];
    // Archive replays don't count: the solve must happen on the puzzle's UTC date.
    if (puzzleDate && completion.completedAt.slice(0, 10) === puzzleDate) dates.add(puzzleDate);
  }
  return dates;
}

function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Consecutive solved days ending today, or yesterday while today is still open. */
export function currentStreak(dates: ReadonlySet<string>, today: string): number {
  let day = dates.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (dates.has(day)) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
}

/** Solved flags for the last `count` days, oldest first, ending today. */
export function recentDays(dates: ReadonlySet<string>, today: string, count: number): boolean[] {
  return Array.from({ length: count }, (_, index) => dates.has(shiftDay(today, index - count + 1)));
}

export type AchievementId = "first-solve" | "clean-history" | "daily-regular" | "on-a-roll" | "week-streak" | "basics-graduate";

export interface Achievement {
  id: AchievementId;
  title: string;
  description: string;
  unlocked: boolean;
}

/** Deterministic achievements from saved progress, so recomputing never duplicates them. */
export function achievements(
  completions: readonly CompletionRecord[],
  options: { lessonIds: readonly string[]; syncedSolves?: readonly DailySolve[] },
): Achievement[] {
  const syncedSolves = options.syncedSolves ?? [];
  const dates = dailySolveDates([...completions, ...syncedSolves]);
  const lessonsDone = new Set(completions.filter((item) => item.kind === "lesson").map((item) => item.puzzleId));
  const bestStreak = longestStreak(dates);
  const list: Omit<Achievement, "unlocked">[] = [
    { id: "first-solve", title: "First commit", description: "Solve any puzzle." },
    { id: "clean-history", title: "Clean history", description: "Solve a puzzle without restarting." },
    { id: "daily-regular", title: "Daily regular", description: "Solve a daily on its day." },
    { id: "on-a-roll", title: "On a roll", description: "Reach a 3-day streak." },
    { id: "week-streak", title: "Week-long streak", description: "Reach a 7-day streak." },
    { id: "basics-graduate", title: "Basics graduate", description: "Finish every Learn Basics lesson." },
  ];
  const unlocked: Record<AchievementId, boolean> = {
    "first-solve": completions.length > 0 || syncedSolves.length > 0,
    "clean-history": completions.some((item) => item.restartCount === 0),
    "daily-regular": dates.size > 0,
    "on-a-roll": bestStreak >= 3,
    "week-streak": bestStreak >= 7,
    "basics-graduate": options.lessonIds.length > 0 && options.lessonIds.every((id) => lessonsDone.has(id)),
  };
  return list.map((item) => ({ ...item, unlocked: unlocked[item.id] }));
}

function longestStreak(dates: ReadonlySet<string>): number {
  let best = 0;
  for (const date of dates) {
    if (dates.has(shiftDay(date, -1))) continue;
    let length = 0;
    let day = date;
    while (dates.has(day)) {
      length++;
      day = shiftDay(day, 1);
    }
    best = Math.max(best, length);
  }
  return best;
}
