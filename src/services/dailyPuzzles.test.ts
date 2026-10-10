import { describe, expect, it } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import { FixtureDailyPuzzleSource, utcDate } from "./dailyPuzzles";

describe("daily puzzle delivery", () => {
  it("loads the requested canonical fixture date", async () => {
    const puzzle = await new FixtureDailyPuzzleSource().getByDate("2026-10-10");
    expect(puzzle.id).toBe("daily-2026-10-10");
    expect(puzzle.publishedOn).toBe("2026-10-10");
  });

  it("derives dates in UTC", () => {
    expect(utcDate(new Date("2026-10-10T23:59:59-07:00"))).toBe("2026-10-11");
  });

  it("rejects a public definition that leaks the private solution", () => {
    const leaked = { ...createDailyFixture("2026-10-10"), solutionCommands: ["git cherry-pick s20"] };
    const result = parsePublicPuzzleDefinition(leaked);
    expect(result.puzzle).toBeUndefined();
    expect(result.issues[0].code).toBe("schema.private-data-exposed");
  });
});
