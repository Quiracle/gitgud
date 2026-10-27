import { describe, expect, it } from "vitest";
import { cloneRepository, executeCommand, getSnapshot } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import { searchDailyPuzzle } from "./quality";
import { createIntegrationCandidate } from "./integration";

describe("prepare-and-integrate family", () => {
  it.each(["medium", "hard"] as const)("validates and accepts both solution routes for %s", (difficulty) => {
    const generated = createIntegrationCandidate("2026-10-26", difficulty, "integration-seed");
    expect(generated.family).toBe("prepare-and-integrate");
    expect(generated.candidate.solutionCommands).toHaveLength(difficulty === "medium" ? 4 : 6);
    expect(validatePuzzleCandidate(generated.candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY }).ok).toBe(true);
    expect(replay(generated.candidate.initialRepository, generated.candidate.solutionCommands)).toEqual(generated.candidate.target.snapshot);

    const commands = ["git cherry-pick c4", "git cherry-pick c5", "git cherry-pick c6", "git cherry-pick c7"];
    if (difficulty === "hard") commands.push("git revert c8", "git cherry-pick c10");
    expect(replay(generated.candidate.initialRepository, commands)).toEqual(generated.candidate.target.snapshot);
  });

  it.each(["medium", "hard"] as const)("keeps its mechanics signature stable across 25 seeds for %s", (difficulty) => {
    const first = createIntegrationCandidate("2026-10-26", difficulty, "seed-0");
    for (let index = 1; index < 25; index += 1) {
      const next = createIntegrationCandidate("2026-10-26", difficulty, `seed-${index}`);
      expect(next.signature).toBe(first.signature);
      expect(next.candidate).not.toEqual(first.candidate);
    }
  });

  it("exhaustively excludes medium solutions through depth 3", () => {
    const generated = createIntegrationCandidate("2026-10-26", "medium", "search-medium");
    const result = searchDailyPuzzle(generated.candidate, {
      maxDepth: 3,
      maxStates: 150_000,
      maxTransitions: 3_000_000,
    });
    expect(result.status).toBe("exhausted");
    expect(result.excludedThroughDepth).toBe(3);
  }, 120_000);

  it("rejects invalid dates, difficulty, and seeds before generation", () => {
    expect(() => createIntegrationCandidate("2026-99-99", "hard", "seed")).toThrow(/date/);
    expect(() => createIntegrationCandidate("2026-02-30", "hard", "seed")).toThrow(/date/);
    expect(() => createIntegrationCandidate("2026-10-26", "easy" as never, "seed")).toThrow(/difficulty/);
    expect(() => createIntegrationCandidate("2026-10-26", "hard", " ")).toThrow(/seed/);
  });
});

function replay(repository: ReturnType<typeof cloneRepository>, commands: string[]) {
  let current = repository;
  for (const command of commands) {
    const result = executeCommand(current, command);
    expect(result.ok, command).toBe(true);
    if (result.ok) current = result.repository;
  }
  return getSnapshot(current, current.branches.main);
}
