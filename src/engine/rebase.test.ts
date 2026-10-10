import { describe, expect, it } from "vitest";
import { planInteractiveRebase } from "./commands/rebase";
import { executeCommand } from "./execute";
import { formatInteractiveRebaseCommand, parseGitCommand } from "./parser";
import { getSnapshot } from "./snapshot";
import type { Commit, Repository, SemanticChange } from "./types";

function commit(
  id: string,
  parents: string[],
  changes: SemanticChange[] = [],
): Commit {
  return { id, parents, message: `message ${id}`, changes, provenance: { type: "original" } };
}

function set(property: string, from: unknown, to: unknown): SemanticChange {
  return { type: "set", property, from, to };
}

function repository(
  commits: Commit[],
  branches: Record<string, string>,
  currentBranch: string,
): Repository {
  return {
    initialState: { hat: "none", scarf: "none", crest: "none" },
    commits: Object.fromEntries(commits.map((item) => [item.id, item])),
    branches,
    currentBranch,
    head: branches[currentBranch],
    nextGeneratedId: 1,
  };
}

/** main adds a hat; feature adds a scarf, then a crest. */
function divergent(): Repository {
  return repository(
    [
      commit("a1", []),
      commit("m1", ["a1"], [set("hat", "none", "blue")]),
      commit("f1", ["a1"], [set("scarf", "none", "turquoise")]),
      commit("f2", ["f1"], [set("crest", "none", "outline")]),
    ],
    { main: "m1", feature: "f2" },
    "feature",
  );
}

/** feature draws a crest outline and then fills it, on top of main. */
function squashable(): Repository {
  return repository(
    [
      commit("a1", []),
      commit("c1", ["a1"], [set("crest", "none", "outline")]),
      commit("c2", ["c1"], [set("crest", "outline", "red")]),
    ],
    { main: "a1", feature: "c2" },
    "feature",
  );
}

function run(source: Repository, command: string): Repository {
  const result = executeCommand(source, command);
  expect(result.ok, result.output.join("\n")).toBe(true);
  return result.repository;
}

describe("rebase parsing", () => {
  it("parses plain and interactive rebases", () => {
    expect(parseGitCommand("git rebase main")).toEqual({
      ok: true,
      action: { type: "rebase", onto: "main" },
    });
    expect(parseGitCommand("git rebase -i main")).toEqual({
      ok: true,
      action: { type: "interactive-rebase", onto: "main" },
    });
    expect(parseGitCommand("git rebase --interactive main")).toMatchObject({
      ok: true,
      action: { type: "interactive-rebase", onto: "main" },
    });
  });

  it("parses todo lines, abbreviations, messages, and comments", () => {
    expect(
      parseGitCommand("git rebase -i main\npick c1 Draw outline\n# comment\ns c2 Fill it\n"),
    ).toEqual({
      ok: true,
      action: {
        type: "interactive-rebase",
        onto: "main",
        todo: [
          { action: "pick", commit: "c1" },
          { action: "squash", commit: "c2" },
        ],
      },
    });
  });

  it("round-trips the transcript form of an edited todo list", () => {
    const todo = [
      { action: "pick", commit: "c1" },
      { action: "squash", commit: "c2" },
    ] as const;
    const command = formatInteractiveRebaseCommand("main", todo);
    expect(command).toBe("git rebase -i main\npick c1\nsquash c2");
    expect(parseGitCommand(command)).toMatchObject({ ok: true, action: { todo } });
  });

  it("rejects unsupported rebase forms with friendly errors", () => {
    expect(parseGitCommand("git rebase")).toMatchObject({ ok: false });
    expect(parseGitCommand("git rebase main feature")).toMatchObject({ ok: false });
    expect(parseGitCommand("git rebase --continue")).toMatchObject({
      ok: false,
      error: expect.stringContaining("nothing to continue"),
    });
    expect(parseGitCommand("git rebase -i main\ndrop c1")).toMatchObject({
      ok: false,
      error: expect.stringContaining("Only pick and squash"),
    });
    expect(parseGitCommand("git rebase -i main\npick")).toMatchObject({ ok: false });
    expect(parseGitCommand("git switch main\npick c1")).toMatchObject({
      ok: false,
      error: "Enter one Git command at a time.",
    });
  });
});

describe("git rebase <branch>", () => {
  it("replays the branch's own commits onto the upstream with rebase provenance", () => {
    const source = divergent();
    const result = executeCommand(source, "git rebase main");
    expect(result.ok).toBe(true);
    const rebased = result.repository;

    expect(rebased.branches.feature).toBe("g2");
    expect(rebased.head).toBe("g2");
    expect(rebased.branches.main).toBe("m1");
    expect(rebased.commits.g1).toMatchObject({
      parents: ["m1"],
      message: "message f1",
      changes: [set("scarf", "none", "turquoise")],
      provenance: { type: "rebase", sourceCommits: ["f1"] },
    });
    expect(rebased.commits.g2).toMatchObject({
      parents: ["g1"],
      provenance: { type: "rebase", sourceCommits: ["f2"] },
    });
    expect(getSnapshot(rebased)).toEqual({ hat: "blue", scarf: "turquoise", crest: "outline" });
    expect(result.output.at(-1)).toBe("Successfully rebased and updated refs/heads/feature.");

    // Original commits remain in the graph and the source repository is untouched.
    expect(rebased.commits.f1).toEqual(source.commits.f1);
    expect(source.branches.feature).toBe("f2");
    expect(source.nextGeneratedId).toBe(1);
  });

  it("generates the same IDs for the same command path", () => {
    const first = run(divergent(), "git rebase main");
    const second = run(divergent(), "git rebase main");
    expect(Object.keys(first.commits).sort()).toEqual(Object.keys(second.commits).sort());
    expect(first).toEqual(second);
  });

  it("reports an up-to-date branch without mutating it", () => {
    const source = divergent();
    const result = executeCommand(source, "git rebase feature");
    expect(result).toMatchObject({
      ok: true,
      mutated: false,
      output: ["Current branch feature is up to date."],
    });
    expect(result.repository).toBe(source);
  });

  it("fast-forwards a branch that is behind its upstream", () => {
    const source = squashable();
    const onMain = run(source, "git switch main");
    const result = executeCommand(onMain, "git rebase feature");
    expect(result).toMatchObject({ ok: true, mutated: true });
    expect(result.repository.branches.main).toBe("c2");
    expect(result.repository.head).toBe("c2");
    expect(Object.keys(result.repository.commits)).toHaveLength(3);
  });

  it("fails atomically on a semantic conflict", () => {
    const source = repository(
      [
        commit("a1", []),
        commit("m1", ["a1"], [set("hat", "none", "blue")]),
        commit("f1", ["a1"], [set("scarf", "none", "turquoise")]),
        commit("f2", ["f1"], [set("hat", "none", "red")]),
      ],
      { main: "m1", feature: "f2" },
      "feature",
    );
    const snapshot = structuredClone(source);
    const result = executeCommand(source, "git rebase main");

    expect(result.ok).toBe(false);
    expect(result.output).toEqual([
      "Merge conflict on `hat` while replaying f2.",
      "",
      "Conflict resolution is not supported in this version.",
    ]);
    expect(result.repository).toBe(source);
    expect(source).toEqual(snapshot);
  });

  it("drops commits whose changes are already upstream", () => {
    const source = repository(
      [
        commit("a1", []),
        commit("m1", ["a1"], [set("hat", "none", "blue")]),
        commit("f1", ["a1"], [set("hat", "none", "blue")]),
        commit("f2", ["f1"], [set("scarf", "none", "turquoise")]),
      ],
      { main: "m1", feature: "f2" },
      "feature",
    );
    const result = executeCommand(source, "git rebase main");

    expect(result.ok).toBe(true);
    expect(result.output[0]).toBe("Dropped f1: its changes are already upstream.");
    expect(result.repository.commits.g1).toMatchObject({
      parents: ["m1"],
      provenance: { type: "rebase", sourceCommits: ["f2"] },
    });
    expect(result.repository.head).toBe("g1");
  });

  it("flattens merge commits on the rebased branch", () => {
    const source = repository(
      [
        commit("a1", []),
        commit("m1", ["a1"], [set("hat", "none", "blue")]),
        commit("f1", ["a1"], [set("scarf", "none", "turquoise")]),
        commit("x1", ["a1"], [set("crest", "none", "red")]),
        commit("fm", ["f1", "x1"], [set("crest", "none", "red")]),
      ],
      { main: "m1", feature: "fm", extra: "x1" },
      "feature",
    );
    const rebased = run(source, "git rebase main");
    const replayed = Object.values(rebased.commits).filter(
      (item) => item.provenance?.type === "rebase",
    );

    expect(replayed.map((item) => item.provenance?.sourceCommits)).toEqual([["f1"], ["x1"]]);
    expect(rebased.commits[rebased.head].parents).toHaveLength(1);
    expect(getSnapshot(rebased)).toEqual({ hat: "blue", scarf: "turquoise", crest: "red" });
  });

  it("rejects unknown upstream branches", () => {
    expect(executeCommand(divergent(), "git rebase nope")).toMatchObject({
      ok: false,
      error: "Unknown branch: nope",
    });
  });
});

describe("git rebase -i <branch>", () => {
  it("squashes consecutive commits into one commit with squash provenance", () => {
    const result = executeCommand(squashable(), "git rebase -i main\npick c1\nsquash c2");
    expect(result.ok).toBe(true);
    const rebased = result.repository;

    expect(rebased.head).toBe("g1");
    expect(rebased.branches.feature).toBe("g1");
    expect(rebased.commits.g1).toEqual({
      id: "g1",
      parents: ["a1"],
      message: "message c1; message c2",
      changes: [set("crest", "none", "red")],
      provenance: { type: "squash", sourceCommits: ["c1", "c2"] },
    });
    expect(getSnapshot(rebased)).toEqual({ hat: "none", scarf: "none", crest: "red" });
    expect(result.output[0]).toBe("Squashed c1, c2 into g1: message c1; message c2");
  });

  it("keeps an unchanged pick-only todo as an up-to-date no-op", () => {
    const source = squashable();
    for (const command of ["git rebase -i main", "git rebase -i main\npick c1\npick c2"]) {
      const result = executeCommand(source, command);
      expect(result).toMatchObject({ ok: true, mutated: false });
      expect(result.repository).toBe(source);
    }
  });

  it("rebases onto a moved upstream while squashing", () => {
    const rebased = run(
      divergent(),
      "git rebase -i main\npick f1\nsquash f2",
    );
    expect(rebased.commits[rebased.head]).toMatchObject({
      parents: ["m1"],
      provenance: { type: "squash", sourceCommits: ["f1", "f2"] },
    });
    expect(getSnapshot(rebased)).toEqual({ hat: "blue", scarf: "turquoise", crest: "outline" });
  });

  it("rejects todo lists that reorder, drop, or start with squash", () => {
    const source = squashable();
    for (const command of [
      "git rebase -i main\npick c2\npick c1",
      "git rebase -i main\npick c1",
      "git rebase -i main\npick c1\npick zz",
      "git rebase -i main\nsquash c1\npick c2",
    ]) {
      const result = executeCommand(source, command);
      expect(result.ok, command).toBe(false);
      expect(result.repository).toBe(source);
    }
  });

  it("plans the default todo list with commit messages", () => {
    expect(planInteractiveRebase(squashable(), "main")).toEqual({
      ok: true,
      onto: "main",
      todo: [
        { action: "pick", commit: "c1", message: "message c1" },
        { action: "pick", commit: "c2", message: "message c2" },
      ],
    });
    expect(planInteractiveRebase(squashable(), "feature")).toEqual({
      ok: true,
      onto: "feature",
      todo: [],
    });
    expect(planInteractiveRebase(squashable(), "nope")).toEqual({
      ok: false,
      error: "Unknown branch: nope",
    });
  });
});
