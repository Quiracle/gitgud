import { describe, expect, it } from "vitest";
import { cloneRepository, executeCommand, type GitAction, type Repository } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCompletion } from "../completion";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate } from "../types";
import candidateJson from "./2026-10-10-movie-night.json";

const candidate = candidateJson as unknown as PuzzleCandidate;

function play(commands: string[]) {
  let repository: Repository = cloneRepository(candidate.initialRepository);
  const actions: GitAction[] = [];
  for (const command of commands) {
    const result = executeCommand(repository, command);
    if (!result.ok) return { failedAt: command, error: result.error, repository, actions };
    repository = result.repository;
    actions.push(result.action);
  }
  return { repository, actions, validation: validatePuzzleCompletion(repository, candidate.target, actions) };
}

describe("2026-10-10 daily: Movie night", () => {
  it("passes the same publication validator as AI-generated dailies", () => {
    const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(result.ok ? [] : result.issues).toEqual([]);
    if (result.ok) expect(result.value.puzzle).not.toHaveProperty("solutionCommands");
  });

  it.each([
    ["revert first, then merge", candidate.solutionCommands],
    ["merge first, then revert", ["git merge cozy", "git revert m12"]],
    ["looking around first", ["git log", "git switch cozy", "git switch main", "git merge cozy", "git revert m12"]],
  ])("accepts %s", (_label, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation?.unmet).toEqual([]);
  });

  it("is not solved at the start", () => {
    expect(play([]).validation?.solved).toBe(false);
  });

  it("refuses a fast-forward-only merge because main and cozy have diverged", () => {
    expect(play(["git merge --ff-only cozy"]).error).toBeDefined();
  });

  it.each([
    ["merging without reverting", "m12", ["git merge cozy"]],
    ["reverting without merging", "k21", ["git revert m12"]],
    ["merging main into cozy and fast-forwarding main", "cozy", [
      "git revert m12", "git switch cozy", "git merge main", "git switch main", "git merge cozy",
    ]],
    ["finishing on the cozy branch", "HEAD", [
      "git revert m12", "git merge cozy", "git switch cozy",
    ]],
  ])("rejects %s", (_label, unmetFragment, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation?.solved).toBe(false);
    expect(run.validation?.unmet.join(" ")).toContain(unmetFragment);
  });
});
