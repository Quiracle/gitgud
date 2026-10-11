import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { achievements, currentStreak, dailySolveDates, recentDays, type DailySolve } from "../lib/progressInsights";
import { learnBasicsCatalog } from "../puzzles";
import { utcDate } from "../services/dailyPuzzles";
import { listSyncedDailySolves } from "../services/syncedProgress";
import { calculateStats } from "../storage/progress";
import { openProgressStore, PROGRESS_CHANGED } from "../storage/browserProgress";

/**
 * Streak, recent days, stats, and achievements from this browser's saved progress. A signed-in
 * player's streak also counts dailies solved on their other devices.
 */
export function useProgressInsights(days = 7) {
  const { status, user } = useAuth();
  const [completions, setCompletions] = useState(() => openProgressStore().completions());
  const [syncedSolves, setSyncedSolves] = useState<DailySolve[]>([]);

  useEffect(() => {
    const refresh = () => setCompletions(openProgressStore().completions());
    window.addEventListener(PROGRESS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    setSyncedSolves([]);
    if (status !== "authenticated" || !user) return;
    let active = true;
    listSyncedDailySolves()
      .then((solves) => active && setSyncedSolves(solves))
      // Offline or unavailable Supabase falls back to this browser's own solves.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, user?.id]);

  return useMemo(() => {
    const today = utcDate();
    const dates = dailySolveDates([...completions, ...syncedSolves]);
    const lessonIds = learnBasicsCatalog.filter((lesson) => lesson.status === "available").map((lesson) => lesson.id);
    return {
      streak: currentStreak(dates, today),
      recent: recentDays(dates, today, days),
      stats: calculateStats(completions),
      lessonsTotal: lessonIds.length,
      achievements: achievements(completions, { lessonIds, syncedSolves }),
    };
  }, [completions, days, syncedSolves]);
}
