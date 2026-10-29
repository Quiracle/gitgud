import { describe, expect, it } from "vitest";
import { cloneRepository, executeCommand, getSnapshot } from "../../engine";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import { createBundledCandidate, createDeterministicCandidate, mechanicsSignature, SUPPORTED_ACTION_TYPES } from "./deterministic";
import type { PuzzleCandidate } from "../types";

describe("deterministic daily candidate fallback", () => {
  it.each(["easy", "medium", "hard"] as const)("is repeatable and solvable at %s difficulty", (difficulty) => {
    const first = createDeterministicCandidate("2026-10-26", difficulty, "reserved-seed", 2);
    const second = createDeterministicCandidate("2026-10-26", difficulty, "reserved-seed", 2);

    expect(first).toEqual(second);
    expect(first.signature).toBeTruthy();
    expect(first.candidate.allowedCommands).toEqual(SUPPORTED_ACTION_TYPES);
    expect(first.candidate.initialRepository.currentBranch).toBe("main");

    const validation = validatePuzzleCandidate(first.candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    expect(validation.ok).toBe(true);
    let repository = cloneRepository(first.candidate.initialRepository);
    for (const command of first.candidate.solutionCommands) {
      const result = executeCommand(repository, command);
      expect(result.ok, command).toBe(true);
      if (result.ok) repository = result.repository;
    }
    expect(getSnapshot(repository, repository.branches.main)).toEqual(first.candidate.target.snapshot);
    expect(repository.currentBranch).toBe("main");
  });

  it("keeps signatures cosmetic-seed invariant and distinguishes topology variants", () => {
    const base = createDeterministicCandidate("2026-10-26", "hard", "seed-a", 0);
    const seedChanged = createDeterministicCandidate("2026-10-26", "hard", "seed-b", 0);
    const variantChanged = createDeterministicCandidate("2026-10-26", "hard", "seed-a", 1);
    expect(seedChanged.signature).toBe(base.signature);
    expect(seedChanged.candidate).not.toEqual(base.candidate);
    expect(variantChanged.signature).not.toBe(base.signature);
  });

  it.each(["easy", "medium", "hard"] as const)("validates 50 seeds and keeps the mechanics signature stable for %s", (difficulty) => {
    const canonical = createDeterministicCandidate("2026-10-26", difficulty, "seed-0", 2);
    for (let index = 0; index < 50; index += 1) {
      const generated = createDeterministicCandidate("2026-10-26", difficulty, `seed-${index}`, 2);
      const blockers = new Set<string>();
      expect(generated.signature).toBe(canonical.signature);
      expect(generated.candidate.id).toBe("daily-2026-10-26");
      expect(generated.candidate.target.snapshot.hat === "none" || generated.candidate.target.snapshot.crest === "none").toBe(true);
      for (const [branch, head] of Object.entries(generated.candidate.initialRepository.branches)) {
        if (branch === "main") continue;
        let current = head;
        while (current !== "c1") {
          const commit = generated.candidate.initialRepository.commits[current];
          const change = commit.changes.find((item) => item.property === "body");
          if (change) {
            blockers.add(String(change.to));
            break;
          }
          current = commit.parents[0];
        }
      }
      expect(blockers.size).toBe(Object.keys(generated.candidate.initialRepository.branches).length - 1);
    }
  });

  it("rejects malformed generation inputs", () => {
    expect(() => createDeterministicCandidate("2026-02-30", "easy", "seed")).toThrow(/date/);
    expect(() => createDeterministicCandidate("2026-10-26", "impossible" as never, "seed")).toThrow(/difficulty/);
    expect(() => createDeterministicCandidate("2026-10-26", "easy", " ")).toThrow(/seed/);
    expect(() => createDeterministicCandidate("2026-10-26", "easy", "seed", -1)).toThrow(/variant/);
  });

  it.each(["easy", "medium", "hard"] as const)("builds a solvable bundled nuisance family at %s difficulty", (difficulty) => {
    const generated = createBundledCandidate("2026-10-26", difficulty, "bundled-seed");
    expect(generated.family).toBe("bundled-nuisance-cleanup");
    expect(generated.candidate.solutionCommands).toHaveLength(difficulty === "easy" ? 2 : difficulty === "medium" ? 4 : 6);
    expect(validatePuzzleCandidate(generated.candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY }).ok).toBe(true);

    let repository = cloneRepository(generated.candidate.initialRepository);
    for (const command of generated.candidate.solutionCommands) {
      const result = executeCommand(repository, command);
      expect(result.ok, command).toBe(true);
      if (result.ok) repository = result.repository;
    }
    expect(getSnapshot(repository, repository.branches.main)).toEqual(generated.candidate.target.snapshot);
    expect(repository.currentBranch).toBe("main");

    const alternate = cloneRepository(generated.candidate.initialRepository);
    const branchNames = Object.keys(alternate.branches).filter((branch) => branch !== "main");
    let alternateRepository = alternate;
    for (const branch of branchNames) {
      const head = alternateRepository.branches[branch];
      const bundledCommit = alternateRepository.commits[head];
      const cleanupCommit = bundledCommit.parents[0];
      for (const command of [`git cherry-pick ${head}`, `git cherry-pick ${cleanupCommit}`]) {
        const result = executeCommand(alternateRepository, command);
        expect(result.ok, command).toBe(true);
        if (result.ok) alternateRepository = result.repository;
      }
    }
    expect(getSnapshot(alternateRepository, alternateRepository.branches.main)).toEqual(generated.candidate.target.snapshot);
  });

  it("signatures retain value equality while ignoring semantic labels", () => {
    const candidate = createBundledCandidate("2026-10-26", "hard", "label-test").candidate;
    const renamed = JSON.parse(JSON.stringify(candidate)) as PuzzleCandidate;
    const propertyNames = Object.keys(renamed.initialRepository.initialState);
    const propertyMap = new Map(propertyNames.map((property, index) => [property, `property-${index}`]));
    const valueMap = new Map([["cream", "vanilla"], ["none", "empty"], ["black", "ink"], ["red", "coral"], ["blue", "azure"], ["turquoise", "teal"], ["purple", "violet"], ["gold", "amber"]]);
    const renameState = (state: Record<string, unknown>) => Object.fromEntries(Object.entries(state).map(([property, value]) => [propertyMap.get(property) ?? property, valueMap.get(String(value)) ?? value]));
    renamed.initialRepository.initialState = renameState(renamed.initialRepository.initialState);
    for (const commit of Object.values(renamed.initialRepository.commits)) {
      commit.changes = commit.changes.map((change) => ({ ...change, property: propertyMap.get(change.property) ?? change.property, from: valueMap.get(String(change.from)) ?? change.from, to: valueMap.get(String(change.to)) ?? change.to }));
    }
    renamed.target.snapshot = renameState(renamed.target.snapshot);
    expect(mechanicsSignature(renamed)).toBe(mechanicsSignature(candidate));

    const alteredRelation = JSON.parse(JSON.stringify(candidate)) as PuzzleCandidate;
    alteredRelation.target.snapshot.body = "black";
    expect(mechanicsSignature(alteredRelation)).not.toBe(mechanicsSignature(candidate));
  });
});
