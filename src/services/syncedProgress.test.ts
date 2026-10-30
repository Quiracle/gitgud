import { describe, expect, it } from "vitest";
import { parseSyncedDailyCompletion, parseSyncedDailySolves } from "./syncedProgress";

describe("parseSyncedDailyCompletion", () => {
  it("preserves the complete transcript and the replayable final run", () => {
    const completion = parseSyncedDailyCompletion({
      id: "server-attempt",
      puzzle_id: "daily-2026-10-10",
      puzzle_version: 1,
      started_at: "2026-10-10T10:00:00.000Z",
      completed_at: "2026-10-10T10:01:00.000Z",
      elapsed_ms: 60_000,
      restart_count: 1,
      command_count: 2,
      assisted: false,
      transcript: [
        { command: "git log", elapsedMs: 2_000, ok: true, output: "history" },
        { command: "git switch feature", elapsedMs: 5_000, ok: true, output: "Switched" },
      ],
      run_commands: ["git switch feature"],
      run_transcript_start: 1,
    });

    expect(completion?.commands).toHaveLength(2);
    expect(completion?.runCommands).toEqual(["git switch feature"]);
    expect(completion?.runTranscriptStart).toBe(1);
  });
});

describe("parseSyncedDailySolves", () => {
  it("keeps well-formed rows and normalises their completion time to UTC", () => {
    expect(
      parseSyncedDailySolves([
        { puzzle_id: "daily-2026-10-11", completed_at: "2026-10-11T00:30:00+02:00", elapsed_ms: 42_000, assisted: true },
        { puzzle_id: "daily-2026-10-10", completed_at: "2026-10-10T08:00:00Z", elapsed_ms: "fast" },
        { puzzle_id: "daily-2026-10-11", completed_at: "not a date" },
        { puzzle_id: 7, completed_at: "2026-10-11T08:00:00Z" },
        null,
      ]),
    ).toEqual([
      { kind: "daily", puzzleId: "daily-2026-10-11", completedAt: "2026-10-10T22:30:00.000Z", elapsedMs: 42_000, assisted: true, gaveUp: true },
      { kind: "daily", puzzleId: "daily-2026-10-10", completedAt: "2026-10-10T08:00:00.000Z" },
    ]);
  });

  it("treats a missing result as no solves", () => {
    expect(parseSyncedDailySolves(null)).toEqual([]);
  });
});

describe("a daily given up on another device", () => {
  const row = {
    id: "server-attempt", puzzle_id: "daily-2026-10-10", puzzle_version: 1, started_at: "2026-10-10T10:00:00.000Z",
    completed_at: "2026-10-10T10:01:00.000Z", elapsed_ms: 60_000, restart_count: 0, command_count: 1, assisted: true,
    transcript: [{ command: "git revert c3", elapsedMs: 0, ok: true, output: "" }], run_commands: ["git revert c3"], run_transcript_start: 0,
  };

  it("arrives finished and unranked, and is not a solve", () => {
    expect(parseSyncedDailyCompletion(row)).toMatchObject({ assisted: true, gaveUp: true, ranked: false, runCommands: ["git revert c3"] });
    expect(parseSyncedDailySolves([row])[0]).toMatchObject({ gaveUp: true });
  });
});
