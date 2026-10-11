import { describe, expect, it } from "vitest";
import { CHICKEN_V2_SEMANTIC_POLICY } from "./chickenTheme";
import { createDailyFixture } from "./dailyFixture";
import { deriveParCommands } from "./par";
import { validatePuzzleCandidate } from "./validateCandidate";

describe("daily par metadata", () => {
  it("counts a private proof to its first win and excludes git log", () => {
    const puzzle = createDailyFixture("2026-10-11");
    expect(deriveParCommands(puzzle, ["git log --all", "git cherry-pick s20", "git log"]))
      .toBe(1);
  });

  it("publishes par without private solution commands and normalizes daily player permissions", () => {
    const candidate = { ...createDailyFixture("2026-10-11"), solutionCommands: ["git cherry-pick s20"] };
    const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.puzzle.parCommands).toBe(1);
    expect(result.value.puzzle.allowedCommands).toContain("interactive-rebase");
    expect(JSON.stringify(result.value.puzzle)).not.toContain("solutionCommands");
  });

  it("rejects authored history requirements on a new daily", () => {
    const candidate = {
      ...createDailyFixture("2026-10-11"),
      target: { ...createDailyFixture("2026-10-11").target, branchHeads: { style: "s20" } },
      solutionCommands: ["git cherry-pick s20"],
    };
    const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain("daily.branch-heads");
  });
});
