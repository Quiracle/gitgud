import { describe, expect, it } from "vitest";
import { createTemplateCandidate } from "./templates";
import { publishedPuzzleNovelty } from "./publishedNovelty";
import { validatePuzzleCandidate } from "../validateCandidate";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";

function fixture() {
  const candidate = createTemplateCandidate("medium-5", "2030-01-01", "history").candidate;
  const validated = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validated.ok) throw new Error("Invalid fixture");
  return { puzzle: validated.value.puzzle, proof: candidate.solutionCommands };
}

describe("published puzzle novelty", () => {
  it("compares historical mechanics without mutating them or counting commands after the first win", () => {
    const { puzzle, proof } = fixture();
    const before = JSON.stringify(puzzle);
    expect(publishedPuzzleNovelty(puzzle, [...proof, "git push"])).toEqual(publishedPuzzleNovelty(puzzle, proof));
    expect(JSON.stringify(puzzle)).toBe(before);
  });
  it("fails closed when history cannot be compared rather than silently omitting it", () => {
    const { puzzle } = fixture();
    expect(() => publishedPuzzleNovelty(puzzle, undefined)).toThrow(/private proof/);
    expect(() => publishedPuzzleNovelty(puzzle, ["git push"])).toThrow(/review/);
    expect(() => publishedPuzzleNovelty(puzzle, [])).toThrow(/target/);
  });
});
