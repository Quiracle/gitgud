import type { CompletionRecord } from "../storage/progress";
import { dailyDate } from "./dailyDate";

/** The parts of a solve that streaks and the solve-time graph need; synced solves carry only these. */
export type DailySolve = Pick<CompletionRecord, "kind" | "puzzleId" | "completedAt"> &
  Partial<Pick<CompletionRecord, "elapsedMs" | "assisted" | "gaveUp">>;

/** Date (YYYY-MM-DD) of each official daily solved on its own day. */
export function dailySolveDates(completions: readonly DailySolve[]): Set<string> {
  const dates = new Set<string>();
  for (const completion of completions) {
    if (completion.kind !== "daily" || completion.gaveUp) continue;
    // Corrected republications get a version suffix: daily-2026-10-10-v2.
    const puzzleDate = /^daily-(\d{4}-\d{2}-\d{2})(?:-v\d+)?$/.exec(completion.puzzleId)?.[1];
    // Archive replays don't count: the solve must happen on the puzzle's own day.
    if (puzzleDate && dailyDate(completion.completedAt) === puzzleDate) dates.add(puzzleDate);
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

export interface DailyTime {
  date: string;
  /** Best unassisted solve of that date's daily; undefined when unsolved. */
  elapsedMs?: number;
}

/**
 * Best daily solve time on each of the last `count` days, oldest first, ending today. A
 * solve lands on the day it was played, so an archive replay shows up today, not on its date.
 */
export function recentDailyTimes(solves: readonly DailySolve[], today: string, count: number): DailyTime[] {
  const best = new Map<string, number>();
  for (const completion of solves) {
    if (completion.kind !== "daily" || completion.assisted || completion.elapsedMs === undefined) continue;
    const date = dailyDate(completion.completedAt);
    best.set(date, Math.min(best.get(date) ?? Infinity, completion.elapsedMs));
  }
  return Array.from({ length: count }, (_, index) => {
    const date = shiftDay(today, index - count + 1);
    return { date, elapsedMs: best.get(date) };
  });
}

const CHART_STEPS_MS = [15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((seconds) => seconds * 1000);

/** The smallest round time per square that fits the slowest solve within `rows` squares. */
export function chartStep(times: readonly number[], rows: number): number {
  const slowest = Math.max(0, ...times);
  return CHART_STEPS_MS.find((step) => slowest <= step * rows) ?? CHART_STEPS_MS.at(-1)!;
}

/** Squares for one solve: rounded to the step, at least one, never above the chart. */
export function chartSquares(elapsedMs: number, step: number, rows: number): number {
  return Math.min(rows, Math.max(1, Math.round(elapsedMs / step)));
}

/** Catalog order, roughly easiest first. Ids are stable: progress and copy are keyed by them. */
export const ACHIEVEMENT_IDS = [
  "first-solve",
  "clean-history",
  "daily-regular",
  "halfway-there",
  "basics-graduate",
  "quick-draw",
  "minimalist",
  "never-give-up",
  "time-traveler",
  "curious-mind",
  "on-a-roll",
  "week-streak",
  "daily-devotee",
  "quarter-century",
  "month-streak",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface Achievement {
  id: AchievementId;
  unlocked: boolean;
  /** When the solve that earned it was completed. */
  unlockedAt?: string;
}

/** A saved solve; ones synced from other devices carry only the daily-solve fields. */
type Solve = DailySolve & Partial<Omit<CompletionRecord, keyof DailySolve>>;

type Rule = (solves: readonly Solve[]) => boolean;

/** Daily puzzles solved, counted once each; revealed solutions excluded. */
function distinctDailies(solves: readonly Solve[]): number {
  return new Set(solves.filter((item) => item.kind === "daily" && !item.assisted).map((item) => item.puzzleId)).size;
}

function lessonsDone(solves: readonly Solve[]): Set<string> {
  return new Set(solves.filter((item) => item.kind === "lesson").map((item) => item.puzzleId));
}

function rules(lessonIds: readonly string[]): Record<AchievementId, Rule> {
  // Run details may be missing from synced solves, and never count with a revealed solution.
  const own = (item: Solve, check: (record: Partial<CompletionRecord>) => boolean) => !item.assisted && check(item);
  return {
    "first-solve": (list) => list.length > 0,
    "clean-history": (list) => list.some((item) => item.restartCount === 0),
    "daily-regular": (list) => dailySolveDates(list).size > 0,
    "halfway-there": (list) => lessonsDone(list).size >= 5,
    "basics-graduate": (list) => {
      const done = lessonsDone(list);
      return lessonIds.length > 0 && lessonIds.every((id) => done.has(id));
    },
    "quick-draw": (list) => list.some((item) => own(item, (run) => run.elapsedMs !== undefined && run.elapsedMs < 30_000)),
    "minimalist": (list) =>
      list.some((item) => own(item, (run) => run.kind === "daily" && run.commandCount !== undefined && run.commandCount <= 3)),
    "never-give-up": (list) => list.some((item) => own(item, (run) => run.restartCount !== undefined && run.restartCount >= 3)),
    "time-traveler": (list) =>
      list.some((item) => {
        const date = /^daily-(\d{4}-\d{2}-\d{2})/.exec(item.puzzleId)?.[1];
        return !item.assisted && item.kind === "daily" && date !== undefined && dailyDate(item.completedAt) > date;
      }),
    "curious-mind": (list) => list.some((item) => item.kind === "generated"),
    "on-a-roll": (list) => longestStreak(dailySolveDates(list)) >= 3,
    "week-streak": (list) => longestStreak(dailySolveDates(list)) >= 7,
    "daily-devotee": (list) => distinctDailies(list) >= 10,
    "quarter-century": (list) => new Set(list.map((item) => item.puzzleId)).size >= 25,
    "month-streak": (list) => longestStreak(dailySolveDates(list)) >= 30,
  };
}

/**
 * Deterministic achievements from saved progress, so recomputing never duplicates them.
 * Every rule only ever turns true as solves are added, so the unlock moment is the first
 * solve (in completion order) after which it holds.
 */
export function achievements(
  completions: readonly CompletionRecord[],
  options: { lessonIds: readonly string[]; syncedSolves?: readonly DailySolve[] },
): Achievement[] {
  // Dailies solved on the player's other devices count too.
  const solves: Solve[] = [...completions, ...(options.syncedSolves ?? [])];
  const sorted = solves.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));
  const table = rules(options.lessonIds);
  return ACHIEVEMENT_IDS.map((id) => {
    const index = unlockIndex(sorted, table[id]);
    return index < 0 ? { id, unlocked: false } : { id, unlocked: true, unlockedAt: sorted[index].completedAt };
  });
}

/** Binary search for the shortest prefix of solves that satisfies a monotonic rule. */
function unlockIndex(sorted: readonly Solve[], rule: Rule): number {
  if (!rule(sorted)) return -1;
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (rule(sorted.slice(0, middle + 1))) high = middle;
    else low = middle + 1;
  }
  return low;
}

/** Most recently unlocked first, topped up with locked ones in catalog order. */
export function featuredAchievements(list: readonly Achievement[], count: number): Achievement[] {
  const unlocked = list
    .filter((item) => item.unlocked)
    .sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  return [...unlocked, ...list.filter((item) => !item.unlocked)].slice(0, count);
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
