import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "../chickenCoronation";
import type { PuzzleCandidate } from "../types";
import { settleShortestRoute } from "./shortestRoute";

const LIMITS = { maxStates: 10_000, maxTransitions: 100_000 };

function candidate(solutionCommands: string[]) {
  return { ...structuredClone(chickenCoronationPuzzle), kind: "daily", solutionCommands } as PuzzleCandidate;
}

describe("settleShortestRoute", () => {
  it("replaces a longer proof with the quickest route and rebuilds the hints from it", () => {
    const detour = candidate(["git revert b22", "git revert g1", "git revert g2", "git cherry-pick s14"]);
    const settled = settleShortestRoute(detour, 1, LIMITS);
    expect(settled?.candidate.solutionCommands).toHaveLength(2);
    expect(settled?.excludedThroughDepth).toBe(1);
    expect(settled?.candidate.hints.join(" ")).toContain(`One route starts with ${settled?.candidate.solutionCommands[0]}`);
    expect(settled?.candidate.hints.join(" ")).not.toContain("git revert g1");
  });

  it("keeps a proof the solver cannot beat, and marks it proven", () => {
    const proof = ["git revert b22", "git cherry-pick s14"];
    expect(settleShortestRoute(candidate(proof), 0, LIMITS)).toMatchObject({ candidate: { solutionCommands: proof }, excludedThroughDepth: 1 });
  });

  it("skips the search when the proof is already proven shortest", () => {
    const proven = candidate(["git revert b22", "git cherry-pick s14"]);
    expect(settleShortestRoute(proven, 1, { maxStates: 1, maxTransitions: 1 })?.candidate).toBe(proven);
  });

  it("gives up rather than guessing when the budget runs out", () => {
    const detour = candidate(["git revert b22", "git revert g1", "git revert g2", "git cherry-pick s14"]);
    expect(settleShortestRoute(detour, 1, { maxStates: 1, maxTransitions: 1 })).toBeUndefined();
  });
});
