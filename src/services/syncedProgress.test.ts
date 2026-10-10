import { describe, expect, it } from "vitest";
import { parseSyncedDailyCompletion } from "./syncedProgress";

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
