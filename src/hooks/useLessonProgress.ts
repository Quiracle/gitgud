import { useCallback, useEffect, useState } from "react";
import { readLessonProgress, recordLessonCompletion, type LessonResult } from "../storage/lessonProgress";

const CHANGED = "gitgud:lesson-progress";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Lesson completions for this browser, shared live across screens. */
export function useLessonProgress() {
  const [lessons, setLessons] = useState<Record<string, LessonResult>>(() => readLessonProgress(storage()));

  useEffect(() => {
    const refresh = () => setLessons(readLessonProgress(storage()));
    window.addEventListener(CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const complete = useCallback((lessonId: string, run: { elapsedMs: number; restartCount: number; hintsUsed: number }) => {
    setLessons(recordLessonCompletion(storage(), lessonId, run));
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return { lessons, complete };
}
