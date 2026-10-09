import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "../puzzles";
import { executeCommand } from "./execute";
import { getSnapshot } from "./snapshot";
import type { Repository } from "./types";
import { validateRepository } from "./validation";

function puzzleRepository(): Repository {
  return structuredClone(chickenCoronationPuzzle.initialRepository);
}

function run(repository: Repository, command: string): Repository {
  const result = executeCommand(repository, command);
  expect(result.ok, result.output.join("\n")).toBe(true);
  return result.repository;
}

function divergentRepository(): Repository {
  return {
    initialState: { hat: "none", scarf: "none" },
    currentBranch: "main",
    head: "m1",
    nextGeneratedId: 1,
    branches: { main: "m1", feature: "f1" },
    commits: {
      root: {
        id: "root",
        parents: [],
        message: "root",
        changes: [],
        provenance: { type: "original" },
      },
      m1: {
        id: "m1",
        parents: ["root"],
        message: "blue hat",
        changes: [{ type: "set", property: "hat", from: "none", to: "blue" }],
        provenance: { type: "original" },
      },
      f1: {
        id: "f1",
        parents: ["root"],
        message: "turquoise scarf",
        changes: [
          { type: "set", property: "scarf", from: "none", to: "turquoise" },
        ],
        provenance: { type: "original" },
      },
    },
  };
}

describe("executeCommand", () => {
  it("accepts both valid command orders for a final-state puzzle", () => {
    let first = puzzleRepository();
    first = run(first, "git revert b22");
    first = run(first, "git cherry-pick s14");

    let second = puzzleRepository();
    second = run(second, "git cherry-pick s14");
    second = run(second, "git revert b22");

    expect(validateRepository(first, chickenCoronationPuzzle.target).solved).toBe(true);
    expect(validateRepository(second, chickenCoronationPuzzle.target).solved).toBe(true);
    expect(getSnapshot(first)).toEqual(getSnapshot(second));
  });

  it("creates deterministic generated IDs within a fresh run", () => {
    const first = run(puzzleRepository(), "git revert b22");
    const restarted = run(puzzleRepository(), "git revert b22");
    expect(first.head).toBe("g1");
    expect(restarted.head).toBe("g1");
  });

  it("performs a three-way merge and records both parents", () => {
    const repository = run(divergentRepository(), "git merge feature");
    expect(repository.commits[repository.head].parents).toEqual(["m1", "f1"]);
    expect(repository.commits[repository.head].provenance).toEqual({
      type: "merge",
      sourceCommits: ["f1"],
    });
    expect(getSnapshot(repository)).toEqual({ hat: "blue", scarf: "turquoise" });
  });

  it("rejects a non-fast-forward merge in ff-only mode without mutation", () => {
    const repository = divergentRepository();
    const result = executeCommand(repository, "git merge --ff-only feature");
    expect(result.ok).toBe(false);
    expect(result.repository).toBe(repository);
    expect(result.repository.head).toBe("m1");
  });

  it("fast-forwards without creating a commit", () => {
    const repository = divergentRepository();
    repository.head = "root";
    repository.branches.main = "root";
    const result = executeCommand(repository, "git merge --ff-only feature");
    expect(result.ok).toBe(true);
    expect(result.repository.head).toBe("f1");
    expect(Object.keys(result.repository.commits)).toHaveLength(3);
  });

  it("fails semantic conflicts atomically", () => {
    const repository = divergentRepository();
    repository.commits.f1.changes = [
      { type: "set", property: "hat", from: "none", to: "red" },
    ];
    const before = structuredClone(repository);
    const result = executeCommand(repository, "git merge feature");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected the merge to fail.");
    expect(result.error).toContain("Merge conflict");
    expect(repository).toEqual(before);
    expect(result.repository).toBe(repository);
  });

  it("switches branches while keeping HEAD attached", () => {
    const repository = run(puzzleRepository(), "git switch style");
    expect(repository.currentBranch).toBe("style");
    expect(repository.head).toBe(repository.branches.style);
  });
});
