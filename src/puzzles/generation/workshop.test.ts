import { describe, expect, it } from "vitest";
import { executeCommand } from "../../engine";
import { validatePuzzleCompletion } from "../completion";
import { createWorkshopCandidate } from "./workshop";

describe("workshop integration puzzles", () => {
  it.each(["medium", "hard"] as const)("accepts its zero-cherry-pick proof for %s across cosmetic variants", difficulty => {
    const reference = createWorkshopCandidate("2030-01-01", difficulty, "reference");
    for (let i = 0; i < 25; i += 1) {
      const { candidate, signature } = createWorkshopCandidate("2030-02-01", difficulty, `seed-${i}`);
      expect(signature).toBe(reference.signature);
      expect(candidate.solutionCommands.some(c => c.startsWith("git cherry-pick"))).toBe(false);
      let repo = candidate.initialRepository;
      for (const command of candidate.solutionCommands) {
        const result = executeCommand(repo, command);
        expect(result.ok, command).toBe(true);
        repo = result.repository;
      }
      expect(validatePuzzleCompletion(candidate, repo, []).solved).toBe(true);
    }
  });
  it("accepts both branch preparation and a useful squash as equal-length medium alternatives", () => {
    const { candidate } = createWorkshopCandidate("2030-01-01", "medium", "reference");
    const alternatives = [
      ["git switch feature", "git revert c6", "git switch main", "git merge feature"],
      ["git switch feature", "git rebase -i base\npick c3\nsquash c4\nsquash c5\npick c6", "git switch main", "git cherry-pick g1"],
    ];
    for (const commands of alternatives) {
      let repo = candidate.initialRepository;
      for (const command of commands) {
        const result = executeCommand(repo, command);
        expect(result.ok, command).toBe(true);
        repo = result.repository;
      }
      expect(validatePuzzleCompletion(candidate, repo, []).solved).toBe(true);
    }
  });
});
