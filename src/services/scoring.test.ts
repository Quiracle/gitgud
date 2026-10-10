import { describe, expect, it } from "vitest";
import { compareRankedResults, type RankedResult } from "./scoring";

const base: RankedResult = {
  elapsedMs: 60_000,
  restartCount: 1,
  commandCount: 5,
  completedAt: "2026-10-10T12:00:00.000Z",
};

describe("leaderboard scoring policy", () => {
  it("orders by time, restarts, commands, then earliest completion", () => {
    expect(compareRankedResults({ ...base, elapsedMs: 59_999 }, base)).toBeLessThan(0);
    expect(compareRankedResults({ ...base, restartCount: 0 }, base)).toBeLessThan(0);
    expect(compareRankedResults({ ...base, commandCount: 4 }, base)).toBeLessThan(0);
    expect(
      compareRankedResults(
        { ...base, completedAt: "2026-10-10T11:59:59.000Z" },
        base,
      ),
    ).toBeLessThan(0);
  });

  it("does not let later tie breakers override a slower solve", () => {
    expect(
      compareRankedResults(
        { ...base, elapsedMs: 60_001, restartCount: 0, commandCount: 1 },
        base,
      ),
    ).toBeGreaterThan(0);
  });
});
