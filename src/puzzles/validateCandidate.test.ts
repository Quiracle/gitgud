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
    const target = solved.target as Record<string, unknown>;
    target.snapshot = {
      sunglasses: true,
      hat: "none",
      scarf: "none",
      crest: "red",
    };
    delete target.requiredProvenance;
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

  it("accepts a different valid command order for the same final target", () => {
    const alternate = candidate();
    alternate.solutionCommands = ["git cherry-pick s14", "git revert b22"];
    const result = validatePuzzleCandidate(alternate, config);
    expect(result.ok).toBe(true);
  });
});
