import { describe, expect, it, vi } from "vitest";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import { FixtureDailyPuzzleSource, SupabaseDailyPuzzleSource, utcDate } from "./dailyPuzzles";

describe("daily puzzle delivery", () => {
  it("loads the requested canonical fixture date", async () => {
    const puzzle = await new FixtureDailyPuzzleSource().getByDate("2026-10-10");
    expect(puzzle.id).toBe("daily-2026-10-10");
    expect(puzzle.publishedOn).toBe("2026-10-10");
  });

  it("replaces a cached daily with the republished current version", async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
    });
    const v1 = createDailyFixture("2026-10-10");
    const v2 = { ...v1, id: "daily-2026-10-10-v2", slug: "daily-2026-10-10-v2", version: 2, title: "Corrected" };
    let current: unknown = v1;
    let reachable = true;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => (reachable ? { data: { definition: current }, error: null } : { data: null, error: { message: "offline" } }),
    };
    const source = new SupabaseDailyPuzzleSource({ from: () => query } as never);

    expect((await source.getByDate("2026-10-10")).version).toBe(1);
    current = v2;
    expect((await source.getByDate("2026-10-10")).id).toBe("daily-2026-10-10-v2");

    // Offline, the last version seen is still playable.
    reachable = false;
    expect((await source.getByDate("2026-10-10")).id).toBe("daily-2026-10-10-v2");
    vi.unstubAllGlobals();
  });

  it("merges par metadata and still loads when the par column is missing", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => null, setItem: () => undefined } });
    const definition = { ...createDailyFixture("2026-10-10") } as Record<string, unknown>;
    delete definition.parCommands;
    let columns = "";
    let hasParColumn = true;
    const query = {
      select: (selected: string) => ((columns = selected), query),
      eq: () => query,
      maybeSingle: async () =>
        columns.includes("par_commands")
          ? hasParColumn
            ? { data: { definition, par_commands: 3 }, error: null }
            : { data: null, error: { code: "42703", message: "column daily_puzzles.par_commands does not exist" } }
          : { data: { definition }, error: null },
    };
    const source = new SupabaseDailyPuzzleSource({ from: () => query } as never);

    expect((await source.getByDate("2026-10-10")).parCommands).toBe(3);
    hasParColumn = false;
    const puzzle = await source.getByDate("2026-10-10");
    expect(puzzle.id).toBe("daily-2026-10-10");
    expect(puzzle.parCommands).toBeUndefined();
    vi.unstubAllGlobals();
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
