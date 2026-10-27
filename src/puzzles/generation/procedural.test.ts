import { describe, expect, it } from "vitest";
import { executeCommand, getSnapshot } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import { createProceduralRepository, proposeProceduralCandidate } from "./procedural";
import { fingerprintMechanics } from "./novelty";

describe("procedural daily mechanics", () => {
  it("is reproducible and changes topology and bundles across seeds", () => {
    const a = createProceduralRepository("alpha", "hard");
    expect(createProceduralRepository("alpha", "hard")).toEqual(a);
    const shapes = new Set(Array.from({ length: 30 }, (_, i) => {
      const repo = createProceduralRepository(`seed-${i}`, "hard");
      return fingerprintMechanics(repo, { branch: "main", snapshot: getSnapshot(repo) }).canonical;
    }));
    expect(shapes.size).toBeGreaterThan(20);
  });

  it("returns deterministic candidates whose private proof replays to the final state", () => {
    const candidates = Array.from({ length: 100 }, (_, i) => proposeProceduralCandidate(`2026-10-${String(i % 28 + 1).padStart(2, "0")}`, "easy", `accept-${i}`)).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== undefined);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY }).ok).toBe(true);
      let repo = candidate.initialRepository;
      for (const command of candidate.solutionCommands) {
        const step = executeCommand(repo, command);
        expect(step.ok).toBe(true);
        if (step.ok) repo = step.repository;
      }
      expect(repo.currentBranch).toBe("main");
      expect(getSnapshot(repo, repo.branches.main)).toEqual(candidate.target.snapshot);
    }
  });

  it.each(["medium", "hard"] as const)("replays %s proposals without hidden command restrictions", difficulty => {
    const candidates = Array.from({ length: 8 }, (_, i) => proposeProceduralCandidate("2030-01-01", difficulty, `proof-${i}`)).filter(candidate => candidate !== undefined);
    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY }).ok).toBe(true);
      expect(candidate.allowedCommands).toContain("interactive-rebase");
      expect(candidate.allowedCommands).toContain("cherry-pick");
      expect(Object.keys(candidate.localizations ?? {}).sort()).toEqual(["ca", "en", "es"]);
    }
  });
});
