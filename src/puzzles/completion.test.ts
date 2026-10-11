import { describe, expect, it } from "vitest";
import { getSnapshot } from "../engine";
import { chickenCoronationPuzzle } from "./chickenCoronation";
import { matchesActionRequirement, validatePuzzleCompletion } from "./completion";

describe("puzzle completion requirements", () => {
  it("distinguishes log and merge variants", () => {
    expect(matchesActionRequirement(
      { type: "log", all: false },
      { type: "log", all: true },
    )).toBe(false);
    expect(matchesActionRequirement(
      { type: "merge", branch: "style", ffOnly: false },
      { type: "merge", ffOnly: true },
    )).toBe(false);
  });

  it("accepts unordered requirements from typed actions or transcript entries", () => {
    const repository = structuredClone(chickenCoronationPuzzle.initialRepository);
    const puzzle = {
      ...structuredClone(chickenCoronationPuzzle),
      kind: "generated" as const,
      target: { branch: "main", snapshot: getSnapshot(repository) },
      actionRequirements: [
        { type: "log" as const, all: false },
        { type: "log" as const, all: true },
      ],
    };

    expect(validatePuzzleCompletion(
      puzzle,
      repository,
      [
        { action: { type: "log", all: true } },
        { type: "log", all: false },
      ],
    )).toMatchObject({ solved: true, unmet: [] });
  });
});
