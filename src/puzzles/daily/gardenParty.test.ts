import { describe, expect, it } from "vitest";
import { cloneRepository, executeCommand, type GitAction, type Repository } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCompletion } from "../completion";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate } from "../types";
import candidateJson from "./2026-10-10-garden-party.json";

const candidate = candidateJson as unknown as PuzzleCandidate;
const squashScarf = "git rebase -i main\npick s21\nsquash s22";

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

describe("2026-10-10 daily: Garden party", () => {
  it("passes the same publication validator as AI-generated dailies", () => {
    const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(result.ok ? [] : result.issues).toEqual([]);
    if (result.ok) expect(result.value.puzzle).not.toHaveProperty("solutionCommands");
  });

  it.each([
    ["squash first, then fast-forward and merge", candidate.solutionCommands],
    ["merge shades first, then squash onto the new main", [
      "git merge shades",
      "git switch scarf",
      squashScarf,
      "git switch main",
      "git merge scarf",
    ]],
    ["squash, then a merge commit for each branch", [
      "git switch scarf",
      squashScarf,
      "git switch main",
      "git merge shades",
      "git merge scarf",
    ]],
  ])("accepts %s", (_label, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation?.unmet).toEqual([]);
  });

  it("is not solved at the start", () => {
    expect(play([]).validation?.solved).toBe(false);
  });

  it.each([
    ["merging scarf without squashing", "squash", [
      "git merge scarf", "git merge shades",
    ]],
    ["squashing but never merging shades", "c32", [
      "git switch scarf", squashScarf, "git switch main", "git merge scarf",
    ]],
    ["rebasing shades instead of merging it", "shades", [
      "git switch scarf", squashScarf,
      "git switch shades", "git rebase scarf",
      "git switch main", "git merge --ff-only shades",
    ]],
    ["finishing on the scarf branch", "HEAD", [
      "git merge shades", "git switch scarf", squashScarf,
    ]],
  ])("rejects %s", (_label, unmetFragment, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation?.solved).toBe(false);
    expect(run.validation?.unmet.join(" ")).toContain(unmetFragment);
  });
});
