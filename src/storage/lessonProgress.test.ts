import { describe, expect, it } from "vitest";
import { LESSON_PROGRESS_KEY, readLessonProgress, recordLessonCompletion, type KeyValueStorage } from "./lessonProgress";

function memory(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial };
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

describe("lesson progress", () => {
  it("starts empty and survives corrupt or foreign data", () => {
    expect(readLessonProgress(memory())).toEqual({});
    expect(readLessonProgress(memory({ [LESSON_PROGRESS_KEY]: "{oops" }))).toEqual({});
    expect(readLessonProgress(memory({ [LESSON_PROGRESS_KEY]: '{"version":9,"lessons":{"a":{}}}' }))).toEqual({});
  });

  it("keeps the first completion date and the best run", () => {
    const storage = memory();
    recordLessonCompletion(storage, "basics-01", { elapsedMs: 9000, restartCount: 2, hintsUsed: 1 }, new Date("2026-10-01T00:00:00Z"));
    recordLessonCompletion(storage, "basics-01", { elapsedMs: 4000, restartCount: 0, hintsUsed: 0 }, new Date("2026-10-02T00:00:00Z"));
    recordLessonCompletion(storage, "basics-01", { elapsedMs: 8000, restartCount: 5, hintsUsed: 3 }, new Date("2026-10-03T00:00:00Z"));

    expect(readLessonProgress(storage)["basics-01"]).toEqual({
      completedAt: "2026-10-01T00:00:00.000Z",
      bestElapsedMs: 4000,
      bestRestartCount: 0,
      hintsUsed: 0,
    });
  });
});
