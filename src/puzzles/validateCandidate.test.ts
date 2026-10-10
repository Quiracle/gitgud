import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "./chickenCoronation";
import { validatePuzzleCandidate } from "./validateCandidate";
import type { PuzzleValidationConfig, SemanticPolicy } from "./policy";

const chickenSemantics: SemanticPolicy = {
  properties: {
    sunglasses: [false, true],
    hat: ["none", "blue"],
    scarf: ["none", "turquoise"],
    crest: ["none", "outline", "red"],
  },
};

const config: PuzzleValidationConfig = { semantic: chickenSemantics };

function candidate(): Record<string, unknown> {
  return {
    ...structuredClone(chickenCoronationPuzzle),
    kind: "generated",
    solutionCommands: ["git revert b22", "git cherry-pick s14"],
  };
}

function issueCodes(input: unknown, options = config): string[] {
  const result = validatePuzzleCandidate(input, options);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function initialTarget(candidateInput: Record<string, unknown>) {
  const target = candidateInput.target as Record<string, unknown>;
  target.snapshot = {
    sunglasses: true,
    hat: "none",
    scarf: "none",
    crest: "red",
  };
  delete target.requiredProvenance;
}

function commit(candidateInput: Record<string, unknown>, id: string): Record<string, unknown> {
  return (((candidateInput.initialRepository as Record<string, unknown>).commits as Record<string, unknown>)[id]) as Record<string, unknown>;
}

describe("validatePuzzleCandidate", () => {
  it("accepts a valid candidate and keeps its solution private", () => {
    const result = validatePuzzleCandidate(candidate(), config);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.puzzle).not.toHaveProperty("solutionCommands");
    expect(JSON.stringify(result.value.puzzle)).not.toContain("solutionCommands");
    expect(result.value.privateMetadata.solutionCommands).toEqual([
      "git revert b22",
      "git cherry-pick s14",
    ]);
  });

  it("rejects missing parent commits and branch heads with stable paths", () => {
    const missingParent = candidate();
    const repository = missingParent.initialRepository as Record<string, unknown>;
    const commits = repository.commits as Record<string, unknown>;
    delete commits.a10;
    expect(issueCodes(missingParent)).toContain("repository.missing-parent");

    const missingHead = candidate();
    ((missingHead.initialRepository as Record<string, unknown>).branches as Record<string, unknown>).style = "nope";
    const result = validatePuzzleCandidate(missingHead, config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "repository.missing-branch-head",
      path: "$.initialRepository.branches.style",
    }));
  });

  it("rejects cyclic graphs and HEAD/current-branch inconsistencies", () => {
    const cyclic = candidate();
    (((cyclic.initialRepository as Record<string, unknown>).commits as Record<string, unknown>).a10 as Record<string, unknown>).parents = ["b22"];
    expect(issueCodes(cyclic)).toContain("repository.cyclic-graph");

    const detached = candidate();
    (detached.initialRepository as Record<string, unknown>).head = "a10";
    expect(issueCodes(detached)).toContain("repository.head-mismatch");
  });

  it("rejects unsupported commands and semantic operations", () => {
    const unsupportedCommand = candidate();
    unsupportedCommand.allowedCommands = ["reset"];
    expect(issueCodes(unsupportedCommand)).toContain("schema.invalid-enum");

    const unsupportedOperation = candidate();
    ((((unsupportedOperation.initialRepository as Record<string, unknown>).commits as Record<string, unknown>).b22 as Record<string, unknown>).changes as Array<Record<string, unknown>>)[0].type = "delete";
    expect(issueCodes(unsupportedOperation)).toContain("semantic.unsupported-operation");
  });

  it("rejects semantic properties and values outside the supplied policy", () => {
    const disallowedProperty = candidate();
    ((((disallowedProperty.initialRepository as Record<string, unknown>).commits as Record<string, unknown>).b22 as Record<string, unknown>).changes as Array<Record<string, unknown>>)[0].property = "cape";
    expect(issueCodes(disallowedProperty)).toContain("semantic.disallowed-property");

    const disallowedValue = candidate();
    ((((disallowedValue.initialRepository as Record<string, unknown>).commits as Record<string, unknown>).b22 as Record<string, unknown>).changes as Array<Record<string, unknown>>)[0].to = "sparkles";
    expect(issueCodes(disallowedValue)).toContain("semantic.disallowed-value");
  });

  it("enforces configurable graph and string limits", () => {
    const oversizedGraph = candidate();
    expect(issueCodes(oversizedGraph, { semantic: chickenSemantics, limits: { maxCommits: 2 } })).toContain("limits.commits");

    const oversizedString = candidate();
    oversizedString.title = "x".repeat(121);
    expect(issueCodes(oversizedString)).toContain("limits.string-length");
  });

  it("rejects a target that is already satisfied at the initial branch head", () => {
    const solved = candidate();
    solved.kind = "daily";
    initialTarget(solved);
    expect(issueCodes(solved)).toContain("target.initially-solved");
  });

  it("rejects hidden solutions that conflict or do not reach the target", () => {
    const conflict = candidate();
    conflict.solutionCommands = ["git cherry-pick b22"];
    expect(issueCodes(conflict)).toContain("solution.conflict");

    const incomplete = candidate();
    incomplete.solutionCommands = ["git log"];
    expect(issueCodes(incomplete)).toContain("solution.target-not-met");

    const disallowed = candidate();
    disallowed.allowedCommands = ["cherry-pick"];
    expect(issueCodes(disallowed)).toContain("solution.disallowed-command");
  });

  it("rejects unsupported or malformed proof syntax, including relative refs", () => {
    for (const command of [
      "git reset b22",
      "git cherry-pick HEAD^",
      "git cherry-pick HEAD~2",
      "git cherry-pick",
      "git revert",
      "git revert b22 extra",
    ]) {
      const invalid = candidate();
      invalid.solutionCommands = [command];
      // HEAD^ and HEAD~ parse as a token in the generic terminal, but cannot
      // resolve to a simulated commit; malformed arity fails parsing directly.
      const codes = issueCodes(invalid);
      expect(codes.some((code) => code === "solution.parse-failed" || code === "solution.execution-failed")).toBe(true);
    }
  });

  it("rejects merge reverts and semantic conflicts in reverts and merges", () => {
    const mergeRevert = candidate();
    const repository = mergeRevert.initialRepository as Record<string, unknown>;
    const commits = repository.commits as Record<string, Record<string, unknown>>;
    commits.b22.parents = ["a10", "s14"];
    mergeRevert.solutionCommands = ["git revert b22"];
    expect(issueCodes(mergeRevert)).toContain("solution.execution-failed");

    const conflictingRevert = candidate();
    const conflictRepo = conflictingRevert.initialRepository as Record<string, unknown>;
    const conflictCommits = conflictRepo.commits as Record<string, Record<string, unknown>>;
    conflictCommits.c99 = {
      id: "c99", parents: ["b22"], message: "Change the sunglasses again",
      changes: [{ type: "set", property: "sunglasses", from: true, to: false }], provenance: { type: "original" },
    };
    (conflictRepo.branches as Record<string, unknown>).main = "c99";
    conflictRepo.head = "c99";
    conflictingRevert.solutionCommands = ["git revert b22"];
    expect(issueCodes(conflictingRevert)).toContain("solution.conflict");

    const mergeConflict = candidate();
    const mergeRepo = mergeConflict.initialRepository as Record<string, unknown>;
    const mergeCommits = mergeRepo.commits as Record<string, Record<string, unknown>>;
    (mergeCommits.b22.changes as Array<Record<string, unknown>>)[0] = { type: "set", property: "crest", from: "red", to: "outline" };
    (mergeCommits.s14.changes as Array<Record<string, unknown>>)[0] = { type: "set", property: "crest", from: "red", to: "none" };
    mergeConflict.solutionCommands = ["git merge style"];
    expect(issueCodes(mergeConflict)).toContain("solution.conflict");
  });

  it("rejects historical changes whose from value is not their first-parent state", () => {
    const invalid = candidate();
    const changes = commit(invalid, "b22").changes as Array<Record<string, unknown>>;
    changes[0].from = true;
    expect(issueCodes(invalid)).toContain("repository.incorrect-change-from");
  });

  it("accepts a different valid command order for the same final target", () => {
    const alternate = candidate();
    alternate.solutionCommands = ["git cherry-pick s14", "git revert b22"];
    const result = validatePuzzleCandidate(alternate, config);
    expect(result.ok).toBe(true);
  });

  it("returns issues rather than throwing for inherited commit and branch lookups", () => {
    const missingParent = candidate();
    commit(missingParent, "b22").parents = ["toString"];
    expect(() => validatePuzzleCandidate(missingParent, config)).not.toThrow();
    expect(issueCodes(missingParent)).toContain("repository.missing-parent");

    const missingHead = candidate();
    ((missingHead.initialRepository as Record<string, unknown>).branches as Record<string, unknown>).style = "constructor";
    expect(issueCodes(missingHead)).toContain("repository.missing-branch-head");

    const missingTarget = candidate();
    (missingTarget.target as Record<string, unknown>).branch = "toString";
    expect(issueCodes(missingTarget)).toContain("target.missing-branch");

    const missingInvariant = candidate();
    (missingInvariant.target as Record<string, unknown>).branchHeads = { toString: "a10" };
    expect(issueCodes(missingInvariant)).toContain("target.missing-invariant-branch");

    const missingProvenance = candidate();
    commit(missingProvenance, "b22").provenance = {
      type: "original",
      sourceCommits: ["constructor"],
    };
    expect(issueCodes(missingProvenance)).toContain("repository.missing-provenance-source");

    const protoKey = candidate();
    const protoCommits = (protoKey.initialRepository as Record<string, unknown>).commits as Record<string, unknown>;
    Object.defineProperty(
      protoCommits,
      "__proto__",
      {
        enumerable: true,
        value: {
          id: "__proto__",
          parents: [],
          message: "Attempt prototype pollution",
          changes: [],
        },
      },
    );
    expect(() => validatePuzzleCandidate(protoKey, config)).not.toThrow();
    expect(issueCodes(protoKey)).toContain("repository.invalid-commit-id");
  });

  it("accepts own commit and branch names that resemble prototype properties", () => {
    const prototypeNames = candidate();
    const repository = prototypeNames.initialRepository as Record<string, unknown>;
    const commits = repository.commits as Record<string, unknown>;
    commits["constructor"] = {
      id: "constructor",
      parents: ["b22"],
      message: "Keep a safely named spare commit",
      changes: [],
      provenance: { type: "original" },
    };
    (repository.branches as Record<string, unknown>)["prototype"] = "constructor";

    expect(validatePuzzleCandidate(prototypeNames, config).ok).toBe(true);
  });

  it("supports a solved-state log lesson only after its required action executes", () => {
    const missingLog = candidate();
    initialTarget(missingLog);
    missingLog.actionRequirements = [{ type: "log", all: false }];
    missingLog.solutionCommands = [];
    expect(issueCodes(missingLog)).not.toContain("target.initially-solved");
    expect(issueCodes(missingLog)).toContain("solution.target-not-met");

    const validLog = candidate();
    initialTarget(validLog);
    validLog.actionRequirements = [{ type: "log", all: false }];
    validLog.solutionCommands = ["git log"];
    expect(validatePuzzleCandidate(validLog, config).ok).toBe(true);
  });

  it("distinguishes action variants and matches multiple requirements in any order", () => {
    const wrongLogVariant = candidate();
    initialTarget(wrongLogVariant);
    wrongLogVariant.actionRequirements = [{ type: "log", all: true }];
    wrongLogVariant.solutionCommands = ["git log"];
    expect(issueCodes(wrongLogVariant)).toContain("solution.target-not-met");

    const orderedIndependently = candidate();
    initialTarget(orderedIndependently);
    orderedIndependently.actionRequirements = [
      { type: "log", all: false },
      { type: "log", all: true },
    ];
    orderedIndependently.solutionCommands = ["git log --all", "git log"];
    expect(validatePuzzleCandidate(orderedIndependently, config).ok).toBe(true);
  });

  it("enforces every bounded metadata collection", () => {
    const tooManyParents = candidate();
    commit(tooManyParents, "a10").parents = ["b22", "s14", "b22"];
    expect(issueCodes(tooManyParents, { semantic: chickenSemantics, limits: { maxParentsPerCommit: 2 } })).toContain("limits.parents-per-commit");

    const tooManySources = candidate();
    commit(tooManySources, "b22").provenance = {
      type: "original",
      sourceCommits: ["a10", "s14"],
    };
    expect(issueCodes(tooManySources, { semantic: chickenSemantics, limits: { maxProvenanceSourcesPerCommit: 1 } })).toContain("limits.provenance-sources-per-commit");

    const tooManyHistoryRequirements = candidate();
    (tooManyHistoryRequirements.target as Record<string, unknown>).requiredProvenance = [
      { type: "revert", sourceCommit: "b22" },
      { type: "cherry-pick", sourceCommit: "s14" },
    ];
    expect(issueCodes(tooManyHistoryRequirements, { semantic: chickenSemantics, limits: { maxRequiredProvenance: 1 } })).toContain("limits.required-provenance");

    const tooManyActions = candidate();
    initialTarget(tooManyActions);
    tooManyActions.actionRequirements = [
      { type: "log", all: false },
      { type: "log", all: true },
    ];
    expect(issueCodes(tooManyActions, { semantic: chickenSemantics, limits: { maxRequiredActions: 1 } })).toContain("limits.required-actions");

    const tooManyBranchHeads = candidate();
    (tooManyBranchHeads.target as Record<string, unknown>).branchHeads = {
      main: "b22",
      style: "s14",
    };
    expect(issueCodes(tooManyBranchHeads, { semantic: chickenSemantics, limits: { maxTargetBranchHeads: 1 } })).toContain("limits.target-branch-heads");
  });
});
