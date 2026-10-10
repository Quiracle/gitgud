import { describe, expect, it } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { LocalProgressStore } from "./progress";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("LocalProgressStore", () => {
  it("resumes an active attempt without resetting its original start", () => {
    let now = Date.parse("2026-10-10T10:00:00Z");
    const storage = new MemoryStorage();
    const store = new LocalProgressStore(storage, () => now, () => "attempt-1");
    const puzzle = createDailyFixture("2026-10-10");

    const first = store.start(puzzle);
    now += 60_000;
    const resumed = store.start(puzzle);

    expect(resumed.id).toBe(first.id);
    expect(resumed.startedAt).toBe("2026-10-10T10:00:00.000Z");
  });

  it("keeps elapsed time and the full transcript across restarts", () => {
    let now = Date.parse("2026-10-10T10:00:00Z");
    const store = new LocalProgressStore(new MemoryStorage(), () => now, () => "attempt-1");
    let attempt = store.start(createDailyFixture("2026-10-10"));
    attempt = store.recordCommand(attempt, {
      command: "git log",
      elapsedMs: 2_000,
      ok: true,
      output: "history",
    });
    attempt = store.restart(attempt);
    now += 90_000;
    const completion = store.complete(attempt, false);

    expect(completion.elapsedMs).toBe(90_000);
    expect(completion.restartCount).toBe(1);
    expect(completion.commandCount).toBe(1);
    expect(completion.commands[0].command).toBe("git log");
  });

  it("calculates replay-safe aggregate statistics", () => {
    let now = Date.parse("2026-10-10T10:00:00Z");
    let id = 0;
    const store = new LocalProgressStore(new MemoryStorage(), () => now, () => `attempt-${++id}`);
    const puzzle = createDailyFixture("2026-10-10");

    let attempt = store.start(puzzle);
    now += 10_000;
    store.complete(attempt, true);
    attempt = store.start(puzzle);
    now += 8_000;
    store.complete(attempt, true);

    expect(store.stats()).toMatchObject({
      completedRuns: 2,
      completedPuzzles: 1,
      completedDailies: 1,
      bestElapsedMs: 8_000,
    });
  });
});
