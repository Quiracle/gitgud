import { describe, expect, it } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { bankedActiveMs, LocalProgressStore } from "./progress";

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

  it("scores active play time, not time the app sat closed", () => {
    let now = Date.parse("2026-10-10T10:00:00Z");
    const storage = new MemoryStorage();
    const store = new LocalProgressStore(storage, () => now, () => "attempt-1");
    let attempt = store.start(createDailyFixture("2026-10-10"));
    attempt = store.setActiveMs(attempt, 30_000);

    // Closed for two hours, then reopened from storage and played 15 more seconds.
    now += 2 * 60 * 60_000;
    const reopened = new LocalProgressStore(storage, () => now).start(createDailyFixture("2026-10-10"));
    expect(bankedActiveMs(reopened)).toBe(30_000);
    const completion = store.complete(reopened, false, 45_000);

    expect(completion.elapsedMs).toBe(45_000);
  });

  it("never rolls banked active time back from a stale copy", () => {
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => "attempt-1");
    const stale = store.start(createDailyFixture("2026-10-10"));
    store.setActiveMs(stale, 20_000);

    const afterCommand = store.recordCommand(stale, { command: "git log", elapsedMs: 21_000, ok: true, output: "" });
    expect(store.setActiveMs(afterCommand, 5_000).activeMs).toBe(20_000);
    expect(store.complete(afterCommand, false).elapsedMs).toBe(20_000);
  });

  it("estimates active time for attempts started before active timing", () => {
    const store = new LocalProgressStore(new MemoryStorage(), Date.now, () => "attempt-1");
    const legacy = store.recordCommand(store.start(createDailyFixture("2026-10-10")), {
      command: "git log", elapsedMs: 12_000, ok: true, output: "",
    });
    expect(bankedActiveMs({ ...legacy, activeMs: undefined })).toBe(12_000);
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

describe("solved puzzle replay data", () => {
  it("keeps the final run on the completion so the solved board can be rebuilt", () => {
    const data = new Map<string, string>();
    const store = new LocalProgressStore({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, () => 1_000, () => "run-1");
    const puzzle = { id: "daily-2026-10-10", version: 1, kind: "daily" } as Parameters<LocalProgressStore["start"]>[0];
    let attempt = store.start(puzzle);
    attempt = store.recordCommand(attempt, { command: "git switch style", elapsedMs: 1, ok: true, output: "" });
    attempt = store.restart(attempt);
    attempt = store.recordCommand(attempt, { command: "git cherry-pick s20", elapsedMs: 2, ok: true, output: "" });
    store.complete(attempt, false);

    expect(store.latestCompletion("daily-2026-10-10", 1)).toMatchObject({
      runCommands: ["git cherry-pick s20"],
      runTranscriptStart: 1,
    });
    expect(store.latestCompletion("daily-2026-10-10", 2)).toBeUndefined();
  });
});

describe("giving up on a daily", () => {
  it("saves the route as the run, keeps the player's history, and never counts as a solve", () => {
    const store = new LocalProgressStore(new MemoryStorage(), () => Date.parse("2026-10-10T10:00:00Z"), () => "attempt-1");
    const puzzle = createDailyFixture("2026-10-10");
    const attempt = store.recordCommand(store.start(puzzle), { command: "git log", elapsedMs: 900, ok: true, output: "" }, false);
    const done = store.surrender(attempt, ["git revert c3", "git cherry-pick c4"], 5_000);
    expect(done).toMatchObject({ assisted: true, gaveUp: true, ranked: false, elapsedMs: 5_000, runCommands: ["git revert c3", "git cherry-pick c4"], runTranscriptStart: 1 });
    expect(done.commands.map((entry) => entry.command)).toEqual(["git log", "git revert c3", "git cherry-pick c4"]);
    expect(store.latestCompletion(puzzle.id, puzzle.version)?.gaveUp).toBe(true);
    expect(store.stats()).toMatchObject({ completedRuns: 0, completedDailies: 0 });
    expect(store.stats().bestElapsedMs).toBeUndefined();
  });

  it("learns each command the first time it is typed, even when it fails", () => {
    let now = Date.parse("2026-10-10T10:00:00Z");
    const store = new LocalProgressStore(new MemoryStorage(), () => now, () => "attempt-1");
    let attempt = store.start(createDailyFixture("2026-10-10"));
    attempt = store.recordCommand(attempt, { command: "git revert nope", elapsedMs: 1_000, ok: false, output: "error" }, false);
    now += 60_000;
    attempt = store.recordCommand(attempt, { command: "git revert b22", elapsedMs: 61_000, ok: true, output: "" });
    attempt = store.recordCommand(attempt, { command: "git commit", elapsedMs: 62_000, ok: false, output: "error" }, false);

    expect(store.learnedCommands()).toEqual({ revert: "2026-10-10T10:00:00.000Z" });
    expect(store.commandCounts()).toEqual({ revert: 2 });
  });

  it("counts every line per command, seeding from older transcripts without double counting", () => {
    const storage = new MemoryStorage();
    const store = new LocalProgressStore(storage, () => Date.parse("2026-10-10T10:00:00Z"), () => "attempt-1");
    let attempt = store.start(createDailyFixture("2026-10-10"));
    // A transcript saved before counting existed.
    const raw = JSON.parse(storage.getItem("gitgud:progress:v1")!);
    const key = Object.keys(raw.activeAttempts)[0];
    raw.activeAttempts[key].commands = [
      { command: "git log", elapsedMs: 1_000, ok: true, output: "" },
      { command: "git log --all", elapsedMs: 2_000, ok: true, output: "" },
    ];
    delete raw.commandCounts;
    storage.setItem("gitgud:progress:v1", JSON.stringify(raw));
    attempt = { ...attempt, commands: raw.activeAttempts[key].commands };

    expect(store.commandCounts()).toEqual({ log: 2 });
    attempt = store.recordCommand(attempt, { command: "git log", elapsedMs: 3_000, ok: true, output: "" });
    attempt = store.recordCommand(attempt, { command: "git checkout main", elapsedMs: 4_000, ok: true, output: "" });

    expect(store.commandCounts()).toEqual({ log: 3, switch: 1 });
  });

  it("counts commands from transcripts saved before learning was tracked, skipping a revealed route", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "gitgud:progress:v1",
      JSON.stringify({
        schemaVersion: 1,
        activeAttempts: {
          "lesson-a@1": {
            id: "a", puzzleId: "lesson-a", puzzleVersion: 1, kind: "lesson", status: "active",
            startedAt: "2026-10-05T10:00:00.000Z", restartCount: 0, commandCount: 1,
            commands: [{ command: "git log", elapsedMs: 5_000, ok: true, output: "" }],
            runCommands: ["git log"], runTranscriptStart: 0,
          },
        },
        completions: [
          {
            id: "b", puzzleId: "daily-2026-10-01", puzzleVersion: 1, kind: "daily",
            startedAt: "2026-10-01T10:00:00.000Z", completedAt: "2026-10-01T10:05:00.000Z",
            elapsedMs: 300_000, restartCount: 0, commandCount: 2, ranked: false, gaveUp: true, assisted: true,
            runTranscriptStart: 1,
            commands: [
              { command: "git checkout main", elapsedMs: 10_000, ok: true, output: "" },
              { command: "git cherry-pick s14", elapsedMs: 300_000, ok: true, output: "" },
            ],
          },
        ],
      }),
    );
    const store = new LocalProgressStore(storage);

    expect(store.learnedCommands()).toEqual({
      switch: "2026-10-01T10:00:10.000Z",
      log: "2026-10-05T10:00:05.000Z",
    });
  });
});
