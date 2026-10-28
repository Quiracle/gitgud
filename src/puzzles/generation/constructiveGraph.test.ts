import { describe, expect, it } from "vitest";
import { getSnapshot, isAncestor } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { createConstructiveProblem } from "./constructiveGraph";

describe("createConstructiveProblem", () => {
  it("keeps every generated hard commit's changes valid on its first-parent state across synthesis seeds", () => {
    for (let i = 0; i < 100; i++) {
      const { repository } = createConstructiveProblem(`synthesis-${i}`, "hard");
      for (const commit of Object.values(repository.commits)) {
        const parentState = commit.parents.length ? getSnapshot(repository, commit.parents[0]) : repository.initialState;
        const changedProperties = new Set<string>();
        for (const change of commit.changes) {
          expect(change.from).toEqual(parentState[change.property]);
          expect(changedProperties.has(change.property)).toBe(false);
          changedProperties.add(change.property);
        }
      }
    }
  });
  it("is deterministic and creates bounded, valid acyclic graphs for each difficulty", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const first = createConstructiveProblem("repeatable-seed", difficulty);
      expect(createConstructiveProblem("repeatable-seed", difficulty)).toEqual(first);
      expect(first.repository.initialState.body).toBe("cream");
      expect(Object.keys(first.repository.commits).length).toBeLessThanOrEqual(25);
      expect(first.target.branch).toBe("main");
      expect(Object.keys(first.target.snapshot)).toEqual(Object.keys(first.repository.initialState));
      expect(CHICKEN_V2_SEMANTIC_POLICY.validateState?.(first.target.snapshot)).toBeUndefined();
      expect(getSnapshot(first.repository, first.repository.branches.main)).not.toEqual(first.target.snapshot);
      for (const head of Object.values(first.repository.branches)) expect(first.repository.commits[head]).toBeDefined();
      for (const commit of Object.values(first.repository.commits)) {
        for (const parent of commit.parents) expect(first.repository.commits[parent]).toBeDefined();
        const before = commit.parents.length ? getSnapshot(first.repository, commit.parents[0]) : first.repository.initialState;
        for (const change of commit.changes) {
          expect(change.from).toEqual(before[change.property]);
          expect(change.to).not.toEqual(change.from);
          expect(["body", "sunglasses", "scarf", "longLegs", "hat"]).toContain(change.property);
          const allowed = change.property === "body" ? ["cream", "red", "blue", "turquoise", "purple", "gold"] : ["none", "red", "blue", "turquoise", "purple", "gold"];
          expect(allowed).toContain(change.from);
          expect(allowed).toContain(change.to);
        }
        // Traversing a commit snapshot detects cycles using the engine itself.
        expect(() => getSnapshot(first.repository, commit.id)).not.toThrow();
      }
    }
  });

  it("respects actual difficulty bounds and always pairs useful work with transient work", () => {
    const limits = { easy: { commits: 8, branches: 3 }, medium: { commits: 14, branches: 5 }, hard: { commits: 25, branches: 8 } } as const;
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      for (let i = 0; i < 20; i++) {
        const { repository, target } = createConstructiveProblem(`bounds-${difficulty}-${i}`, difficulty);
        expect(Object.keys(repository.commits).length).toBeLessThanOrEqual(limits[difficulty].commits);
        expect(Object.keys(repository.branches).length).toBeLessThanOrEqual(limits[difficulty].branches);
        const initial = getSnapshot(repository, repository.branches.main);
        const useful = new Set(Object.keys(target.snapshot).filter(property => target.snapshot[property] !== initial[property]));
        const mainHistory = new Set<string>();
        let cursor: string | undefined = repository.branches.main;
        while (cursor) { mainHistory.add(cursor); cursor = repository.commits[cursor].parents[0]; }
        const paired = Object.values(repository.commits).filter(commit => !mainHistory.has(commit.id) && commit.changes.length === 2 && commit.changes.some(change => useful.has(change.property)));
        expect(paired.length).toBeGreaterThan(0);
        expect(paired.every(commit => commit.changes.some(change => useful.has(change.property)))).toBe(true);
      }
    }
  });

  it("varies branch bases and which transient step receives the useful edit", () => {
    let sideHistoryForks = 0;
    const positions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { repository, target } = createConstructiveProblem(`variation-${i}`, "hard");
      const branchHeads = ["feature", "polish", "release"].map(branch => repository.branches[branch]).filter((head): head is string => Boolean(head));
      // A shared intermediate side commit matters; inheriting a complete earlier
      // target feature is deliberately excluded by the constructive sampler.
      if (branchHeads.some((head, index) => branchHeads.slice(0, index).some(earlier =>
        Object.keys(repository.commits).some(id => !isAncestor(repository, id, repository.branches.main) && isAncestor(repository, id, earlier) && isAncestor(repository, id, head))))) sideHistoryForks++;
      const initial = getSnapshot(repository, repository.branches.main);
      const mainHistory = new Set<string>();
      let mainCursor: string | undefined = repository.branches.main;
      while (mainCursor) { mainHistory.add(mainCursor); mainCursor = repository.commits[mainCursor].parents[0]; }
      const guards = new Set([...mainHistory].flatMap(id => repository.commits[id].changes.map(change => change.property)));
      const useful = new Set(Object.keys(target.snapshot).filter(property => target.snapshot[property] !== initial[property] && !guards.has(property)));
      for (const commit of Object.values(repository.commits)) {
        if (commit.changes.length === 2 && commit.changes.some(change => useful.has(change.property))) {
          const transient = commit.changes.find(change => !useful.has(change.property));
          if (!transient) continue;
          positions.add(`${transient.from}->${transient.to}:${transient.to === "red" ? "red" : "other"}`);
        }
      }
    }
    expect(sideHistoryForks).toBeGreaterThan(0);
    expect(positions.size).toBeGreaterThan(1);
  });

  it("keeps root and main forks common, samples earlier commits, and makes the root branch optional", () => {
    let baseBranchCount = 0;
    let totalSideBranches = 0;
    let rootForks = 0;
    let mainForks = 0;
    let earlierCommitForks = 0;
    const sampleCount = 200;
    for (let i = 0; i < sampleCount; i++) {
      const { repository, branchBases } = createConstructiveProblem(`fork-policy-${i}`, "hard");
      if (repository.branches.base === "c1") baseBranchCount++;
      for (const name of ["feature", "polish", "release"]) {
        const head = repository.branches[name];
        if (!head) continue;
        totalSideBranches++;
        const cursor = branchBases[name];
        expect(isAncestor(repository, cursor, head)).toBe(true);
        if (cursor === "c1") rootForks++;
        else if (cursor === repository.branches.main) mainForks++;
        else earlierCommitForks++;
      }
    }
    expect(baseBranchCount / sampleCount).toBeGreaterThan(0.3);
    expect(baseBranchCount / sampleCount).toBeLessThan(0.95);
    expect(rootForks / totalSideBranches).toBeGreaterThan(0.2);
    expect(mainForks / totalSideBranches).toBeGreaterThan(0.1);
    expect(earlierCommitForks / totalSideBranches).toBeGreaterThan(0.1);
  });
});

