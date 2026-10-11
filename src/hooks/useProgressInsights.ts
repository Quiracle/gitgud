import { useEffect, useMemo, useState } from "react";
import { achievements, currentStreak, dailySolveDates, recentDailyTimes, recentDays } from "../lib/progressInsights";
import { learnBasicsCatalog } from "../puzzles";
import { utcDate } from "../services/dailyPuzzles";
import { calculateStats } from "../storage/progress";
import { openProgressStore, PROGRESS_CHANGED } from "../storage/browserProgress";

/** Days shown in the daily solve-time chart. */
export const CHART_DAYS = 10;

/** Streak, recent days, solve times, stats, and achievements from this browser's saved progress. */
export function useProgressInsights(days = 7) {
  const [completions, setCompletions] = useState(() => openProgressStore().completions());

  useEffect(() => {
    const refresh = () => setCompletions(openProgressStore().completions());
    window.addEventListener(PROGRESS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return useMemo(() => {
    const today = utcDate();
    const dates = dailySolveDates(completions);
    const lessonIds = learnBasicsCatalog.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id);
    return {
      streak: currentStreak(dates, today),
      recent: recentDays(dates, today, days),
      dailyTimes: recentDailyTimes(completions, today, CHART_DAYS),
      stats: calculateStats(completions),
      lessonsTotal: lessonIds.length,
      achievements: achievements(completions, { lessonIds }),
    };
  }, [completions, days]);
}
