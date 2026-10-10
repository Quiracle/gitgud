import { useEffect, useState } from "react";
import { openProgressStore, PROGRESS_CHANGED } from "../storage/browserProgress";

export interface LessonBest {
  completedAt: string;
  bestElapsedMs: number;
  bestRestartCount: number;
}

/** Completed lessons for this browser, from the shared progress store, kept live. */
export function useLessonProgress() {
  const [lessons, setLessons] = useState(readLessons);

  useEffect(() => {
    const refresh = () => setLessons(readLessons());
    window.addEventListener(PROGRESS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { lessons };
}

function readLessons(): Record<string, LessonBest> {
  const best: Record<string, LessonBest> = {};
  for (const completion of openProgressStore().completions()) {
    if (completion.kind !== "lesson") continue;
    const previous = best[completion.puzzleId];
    if (!previous || completion.elapsedMs < previous.bestElapsedMs) {
      best[completion.puzzleId] = {
        completedAt: previous?.completedAt ?? completion.completedAt,
        bestElapsedMs: completion.elapsedMs,
        bestRestartCount: completion.restartCount,
      };
    }
  }
  return best;
}
