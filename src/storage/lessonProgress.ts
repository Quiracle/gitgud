/**
 * Guest lesson progress, kept in localStorage until account sync lands. The record is
 * versioned so a future schema can migrate or safely discard it.
 */
export interface LessonResult {
  completedAt: string;
  bestElapsedMs: number;
  bestRestartCount: number;
  hintsUsed: number;
}

interface StoredProgress {
  version: 1;
  lessons: Record<string, LessonResult>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LESSON_PROGRESS_KEY = "gitgud:lessons:v1";
const EMPTY: StoredProgress = { version: 1, lessons: {} };

export function readLessonProgress(storage: KeyValueStorage | undefined): Record<string, LessonResult> {
  try {
    const raw = storage?.getItem(LESSON_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    return parsed.version === 1 && parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {};
  } catch {
    // Corrupt or blocked storage behaves like a fresh guest.
    return {};
  }
}

/** Records a completion, keeping the best time and never un-completing a lesson. */
export function recordLessonCompletion(
  storage: KeyValueStorage | undefined,
  lessonId: string,
  run: { elapsedMs: number; restartCount: number; hintsUsed: number },
  now = new Date(),
): Record<string, LessonResult> {
  const lessons = readLessonProgress(storage);
  const previous = lessons[lessonId];
  const better = !previous || run.elapsedMs < previous.bestElapsedMs;
  lessons[lessonId] = {
    completedAt: previous?.completedAt ?? now.toISOString(),
    bestElapsedMs: better ? run.elapsedMs : previous.bestElapsedMs,
    bestRestartCount: better ? run.restartCount : previous.bestRestartCount,
    hintsUsed: better ? run.hintsUsed : previous.hintsUsed,
  };
  try {
    storage?.setItem(LESSON_PROGRESS_KEY, JSON.stringify({ ...EMPTY, lessons }));
  } catch {
    // Progress still shows for this session when storage is full or blocked.
  }
  return lessons;
}
