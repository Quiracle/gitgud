import { describe, expect, it } from "vitest";
import { executeCommand, getSnapshot, planInteractiveRebase, type Repository } from "../../engine";
import { createDailyFixture } from "../dailyFixture";
import { validatePuzzleCompletion } from "../completion";
import type { PublicPuzzleDefinition } from "../types";
import { dailySearchCommands, repositorySearchKey, searchDailyPuzzle } from "./quality";

function commit(id: string, parents: string[], property?: string, from?: unknown, to?: unknown) {
  return {
    id, parents, message: id,
    changes: property === undefined ? [] : [{ type: "set" as const, property, from, to }],
    provenance: { type: "original" as const },
  };
}

function daily(repository: Repository, target: Repository["initialState"], branch = "main"): PublicPuzzleDefinition {
  return {
    schemaVersion: 1, id: "test-daily", version: 1, kind: "daily", slug: "test-daily",
    title: "Test", description: "Test", difficulty: "easy", initialRepository: repository,
    target: { branch, snapshot: target }, allowedCommands: ["log", "switch", "merge", "cherry-pick", "revert", "rebase", "interactive-rebase"], hints: [],
  };
}

function transferPuzzle(): PublicPuzzleDefinition {
  const state = { item: "none" };
  const repository: Repository = {
    initialState: state, currentBranch: "main", head: "m1", nextGeneratedId: 1,
    branches: { main: "m1", feature: "f1" },
    commits: {
      a: commit("a", []), m1: commit("m1", ["a"]),
      f1: commit("f1", ["a"], "item", "none", "blue"),
    },
  };
  return daily(repository, { item: "blue" });
}

function squashPuzzle(): PublicPuzzleDefinition {
  const state = { color: "none", badge: "none" };
  const repository: Repository = {
    initialState: state, currentBranch: "work", head: "w2", nextGeneratedId: 1,
    branches: { main: "m1", work: "w2" },
    commits: {
      a: commit("a", []), m1: commit("m1", ["a"]),
      w1: commit("w1", ["a"], "color", "none", "blue"),
      w2: commit("w2", ["w1"], "badge", "none", "gold"),
    },
  };
  return daily(repository, { color: "blue", badge: "gold" });
}

describe("daily puzzle quality oracle", () => {
  it("finds a shorter merge shortcut even when the submitted proof is padded", () => {
    const puzzle = transferPuzzle();
    const result = searchDailyPuzzle(puzzle, { maxDepth: 3 });
    expect(result.status).toBe("solved");
    expect(result.shortestCommands).toEqual(["git merge feature"]);
    const paddedProof = ["git switch feature", "git switch main", "git merge feature"];
    expect(paddedProof.length).toBeGreaterThan(result.shortestCommands!.length);
  });

  it("keeps ancestry-distinct repositories apart despite equal snapshots", () => {
    const puzzle = transferPuzzle();
    const altered = structuredClone(puzzle.initialRepository);
    altered.commits.f1.parents = ["m1"];
    altered.branches.feature = "f1";
    expect(getSnapshot(altered)).toEqual(getSnapshot(puzzle.initialRepository));
    expect(repositorySearchKey(altered)).not.toBe(repositorySearchKey(puzzle.initialRepository));
  });

  it("retains generated commits so later commands can pick or revert them", () => {
    const puzzle = transferPuzzle();
    const first = executeCommand(puzzle.initialRepository, "git cherry-pick f1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const generated = first.repository.head;
    expect(first.repository.commits[generated]).toBeDefined();
    expect(dailySearchCommands(first.repository).commands).toContain(`git revert ${generated}`);
  });

  it("enumerates every ordered squash partition and rebases onto current branch", () => {
    const repository = squashPuzzle().initialRepository;
    const commands = dailySearchCommands(repository).commands;
    expect(commands).toContain("git rebase -i main\npick w1\npick w2");
    expect(commands).toContain("git rebase -i main\npick w1\nsquash w2");
    expect(commands).toContain("git rebase -i work");
  });

  it("omits log, checkout alias, and ff-only duplicates from state search", () => {
    const commands = dailySearchCommands(transferPuzzle().initialRepository).commands;
    expect(commands.some((command) => command.startsWith("git log"))).toBe(false);
    expect(commands.some((command) => command.startsWith("git checkout"))).toBe(false);
    expect(commands.some((command) => command.includes("--ff-only"))).toBe(false);
  });

  it("marks small search budgets as inconclusive instead of claiming exhaustion", () => {
    const puzzle = { ...transferPuzzle(), target: { branch: "main", snapshot: { item: "green" } } };
    expect(searchDailyPuzzle(puzzle, { maxDepth: 3, maxTransitions: 1 })).toMatchObject({ status: "budget-exhausted", reason: "transitions" });
    expect(searchDailyPuzzle(puzzle, { maxDepth: 3, maxStates: 1 })).toMatchObject({ status: "budget-exhausted", reason: "states" });
    expect(searchDailyPuzzle(squashPuzzle(), { maxDepth: 3, maxInteractivePlans: 1 })).toMatchObject({ status: "budget-exhausted", reason: "interactive-plans" });
  });

  it("returns a shortest replayable route, recognizes an initially solved state, and rejects lessons", () => {
    const puzzle = transferPuzzle();
    const result = searchDailyPuzzle(puzzle, { maxDepth: 2 });
    expect(result.shortestCommands).toHaveLength(1);
    let repo = puzzle.initialRepository;
    for (const command of result.shortestCommands!) {
      const step = executeCommand(repo, command);
      expect(step.ok).toBe(true);
      if (step.ok) repo = step.repository;
    }
    expect(validatePuzzleCompletion(puzzle, repo, []).solved).toBe(true);
    expect(searchDailyPuzzle({ ...puzzle, initialRepository: repo }, { maxDepth: 0 })).toMatchObject({ status: "solved", shortestCommands: [] });
    expect(() => searchDailyPuzzle({ ...puzzle, kind: "lesson" }, { maxDepth: 2 })).toThrow(/daily puzzle/);
  });
});

// Deliberately independent bounded reference: enumerate explicit command forms and
// execute them through the public simulator, without the production pruner or key.
function bruteForce(puzzle: PublicPuzzleDefinition, maxDepth: number): number | undefined {
  let layer = [puzzle.initialRepository];
  const seen = new Set<string>([JSON.stringify(puzzle.initialRepository)]);
  if (validatePuzzleCompletion(puzzle, layer[0], []).solved) return 0;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next: Repository[] = [];
    for (const repo of layer) {
      const commands: string[] = [];
      Object.keys(repo.branches).forEach((branch) => {
        commands.push(`git switch ${branch}`, `git merge ${branch}`, `git merge --ff-only ${branch}`, `git rebase ${branch}`);
        const plan = planInteractiveRebase(repo, branch);
        if (plan.ok) {
          const n = plan.todo.length;
          for (let mask = 0; mask < 2 ** Math.max(0, n - 1); mask += 1) {
            const todo = plan.todo.map((entry, index) => `${index && (mask >> (index - 1)) & 1 ? "squash" : "pick"} ${entry.commit}`);
            commands.push(`git rebase -i ${branch}${todo.length ? `\n${todo.join("\n")}` : ""}`);
          }
        }
      });
      Object.keys(repo.commits).forEach((id) => commands.push(`git cherry-pick ${id}`, `git revert ${id}`));
      for (const command of commands) {
        const step = executeCommand(repo, command);
        if (!step.ok || !step.mutated) continue;
        if (validatePuzzleCompletion(puzzle, step.repository, []).solved) return depth;
        const key = JSON.stringify(step.repository);
        if (!seen.has(key)) { seen.add(key); next.push(step.repository); }
      }
    }
    layer = next;
  }
  return undefined;
}

describe("daily shortest search against bounded brute force", () => {
  it.each([transferPuzzle(), squashPuzzle(), createDailyFixture("2026-10-26")])("agrees with independent brute force for shallow graphs", (puzzle) => {
    const bound = 2;
    const brute = bruteForce(puzzle, bound);
    const actual = searchDailyPuzzle(puzzle, { maxDepth: bound, maxStates: 20_000, maxTransitions: 500_000, maxInteractivePlans: 128 });
    if (brute === undefined) expect(actual.status).toBe("exhausted");
    else expect(actual.shortestCommands).toHaveLength(brute);
  });
});
