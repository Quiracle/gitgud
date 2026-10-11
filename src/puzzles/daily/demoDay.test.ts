import { describe, expect, it } from "vitest";
import { cloneRepository, executeCommand, type GitAction, type Repository } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCompletion } from "../completion";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate } from "../types";
import candidateJson from "./2026-10-10-demo-day.json";

const candidate = candidateJson as unknown as PuzzleCandidate;
const squashStilts = "git rebase -i main\npick t61\nsquash t62\nsquash t63";

function play(commands: string[]) {
  let repository: Repository = cloneRepository(candidate.initialRepository);
  const actions: GitAction[] = [];
  for (const command of commands) {
    const result = executeCommand(repository, command);
    if (!result.ok) return { failedAt: command, error: result.error, repository, actions };
    repository = result.repository;
    actions.push(result.action);
  }
  return { repository, actions, validation: validatePuzzleCompletion(candidate, repository, actions) };
}

describe("2026-10-10 daily: Demo day", () => {
  it("is retained as an immutable legacy daily, despite its now-disallowed hidden crest", () => {
    const result = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "semantic.incompatible-visual-state",
      path: "$.target.snapshot",
    }));
  });

  it.each([
    ["squash first, then lanyard on top, then main", candidate.solutionCommands],
    ["main first, each branch rebased onto main afterwards", [
      "git revert m12",
      "git merge glam",
      "git cherry-pick x42",
      "git switch lanyard",
      "git rebase main",
      "git switch main",
      "git merge lanyard",
      "git switch stilts",
      squashStilts,
      "git switch main",
      "git merge --ff-only stilts",
    ]],
    ["squash early, non-fast-forward merges into a moved main", [
      "git switch stilts",
      squashStilts,
      "git switch lanyard",
      "git rebase main",
      "git switch main",
      "git cherry-pick x42",
      "git merge stilts",
      "git merge lanyard",
      "git revert m12",
      "git merge glam",
    ]],
    ["interactive rebases for both lanyard and stilts", [
      "git switch lanyard",
      "git rebase -i main",
      "git switch stilts",
      "git rebase -i lanyard\npick t61\nsquash t62\nsquash t63",
      "git switch main",
      "git merge --ff-only stilts",
      "git merge glam",
      "git revert m12",
      "git cherry-pick x42",
    ]],
  ])("accepts %s", (_label, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation?.unmet).toEqual([]);
  });

  it("is not solved at the start", () => {
    expect(play([]).validation?.solved).toBe(false);
  });

  it("wins when the chicken matches on main even when legacy history metadata is unmet", () => {
    const run = play([
      "git revert m12", "git merge glam", "git merge lanyard", "git cherry-pick x42", "git merge stilts",
    ]);
    expect(run.error).toBeUndefined();
    expect(run.validation).toMatchObject({ solved: true, unmet: [] });
  });

  it("explains why the final stilts commit can't be cherry-picked on its own", () => {
    const run = play(["git cherry-pick t63"]);
    expect(run.error).toContain("Merge conflict on `longLegs`");
    expect(run.error).toContain("Conflict resolution is not supported in this version.");
  });

  it("blocks merging the whole lab branch with a conflict", () => {
    const run = play(["git merge lab"]);
    expect(run.error).toMatch(/conflict/i);
  });

  it.each([
    ["merging stilts without squashing", "squash", [
      "git revert m12", "git merge glam", "git cherry-pick x42",
      "git switch lanyard", "git rebase main", "git switch main", "git merge lanyard",
      "git merge stilts",
    ]],
    ["squashing only two of the three stilts commits", "squash of 't61'", [
      "git switch stilts", "git rebase -i main\npick t61\npick t62\nsquash t63",
      "git switch lanyard", "git rebase stilts", "git switch main", "git merge lanyard",
      "git merge glam", "git cherry-pick x42", "git revert m12",
    ]],
    ["merging lanyard instead of rebasing it", "rebase of 'l71'", [
      "git switch stilts", squashStilts, "git switch main", "git merge stilts",
      "git merge lanyard", "git merge glam", "git cherry-pick x42", "git revert m12",
    ]],
    ["rebasing the shared glam branch", "glam", [
      "git switch stilts", squashStilts, "git switch lanyard", "git rebase stilts",
      "git switch glam", "git rebase lanyard", "git switch main", "git merge glam",
      "git cherry-pick x42", "git revert m12",
    ]],
  ])("accepts %s as a daily state-only solution", (_label, _unmetFragment, commands) => {
    const run = play(commands);
    expect(run.error).toBeUndefined();
    expect(run.validation).toMatchObject({ solved: true, unmet: [] });
  });
});
