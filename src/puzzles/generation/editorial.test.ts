import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "../chickenCoronation";
import { applyStoryText, createTemplateLocalizations } from "./editorial";
import { DEFAULT_PUZZLE_LIMITS } from "../policy";
import type { PuzzleCandidate } from "../types";

function candidate() {
  return { ...structuredClone(chickenCoronationPuzzle), objectives: ["Make main match the target."], solutionCommands: ["git revert b22", "git cherry-pick s14"] } as PuzzleCandidate;
}

describe("daily editorial copy", () => {
  it("creates deterministic, complete three-locale stories and bounded factual copy", () => {
    const puzzle = candidate();
    const first = createTemplateLocalizations(puzzle, "family", "seed");
    expect(createTemplateLocalizations(puzzle, "family", "seed")).toEqual(first);
    expect(Object.keys(first)).toEqual(["en", "ca", "es"]);
    expect(new Set(Array.from({ length: 24 }, (_, index) => createTemplateLocalizations(puzzle, `family-${index}`, "seed").en.title)).size).toBe(8);
    for (const locale of ["en", "ca", "es"] as const) {
      expect(first[locale].objectives).toHaveLength(puzzle.objectives?.length ?? 0);
      expect(first[locale].hints).toHaveLength(first.en.hints.length);
      expect(first[locale].title.length).toBeLessThanOrEqual(DEFAULT_PUZZLE_LIMITS.maxTitleLength);
      expect(first[locale].description.length).toBeLessThanOrEqual(DEFAULT_PUZZLE_LIMITS.maxDescriptionLength);
      expect(Object.keys(first[locale].commitMessages).sort()).toEqual(Object.keys(puzzle.initialRepository.commits).sort());
      expect(first[locale].hints.at(-1)).toContain(puzzle.solutionCommands[0]);
      expect(first[locale].hints.join(" ").toLowerCase()).not.toContain("private proof");
    }
    expect(first.en.description).not.toMatch(/\bA a\b/i);
    expect(first.en.commitMessages.b22).toContain("sunglasses");
  });

  it("uses mechanics-specific guidance and distinguishes commit refs from branch refs", () => {
    const puzzle = candidate();
    puzzle.solutionCommands = ["git merge style"];
    const branchHint = createTemplateLocalizations(puzzle, "branch-only", "seed").en.hints[1];
    expect(branchHint).not.toContain("commit style");
    expect(branchHint).toContain("branch");
    const dependency = candidate();
    dependency.initialRepository.commits.s14.parents = ["b22"];
    dependency.solutionCommands = ["git cherry-pick b22", "git cherry-pick s14"];
    const dependentHint = createTemplateLocalizations(dependency, "dependency-family", "seed").en.hints[0];
    expect(dependentHint).toContain("depend on an earlier value");
    expect(createTemplateLocalizations(candidate(), "repair-family", "seed").en.hints[0]).toContain("needs repair");
    expect(createTemplateLocalizations({ ...candidate(), solutionCommands: ["git cherry-pick s14"] }, "bundle-family", "seed").en.hints[0]).toContain("across the branches");
    expect(createTemplateLocalizations(puzzle, "branch-only", "seed").en.hints[2]).toContain("One possible route");
  });

  it("describes prepare-and-integrate and bundled cleanup without hiding useful branch work", () => {
    const puzzle = candidate();
    puzzle.solutionCommands = ["git switch feature", "git revert b22", "git switch main", "git merge feature"];
    const integration = createTemplateLocalizations(puzzle, "prepare-and-integrate", "seed").en.hints;
    expect(integration[0]).toContain("prepare work on another branch before integrating it");
    expect(integration[0]).toContain("unwanted change");
    expect(integration[2]).toContain("One possible route begins with git switch feature");

    const bundled = createTemplateLocalizations(candidate(), "bundled-nuisance-cleanup", "seed").en.hints[0];
    expect(bundled).toContain("useful changes across the branches");
    expect(bundled).not.toContain("needs repair");
  });

  it("accepts only exact localized title/description records", () => {
    const puzzle = candidate();
    const good = {
      en: { title: "Studio portrait", description: "A portrait is ready for display." },
      ca: { title: "Retrat d'estudi", description: "Un retrat està a punt per exposar." },
      es: { title: "Retrato de estudio", description: "Un retrato está listo para exponer." },
    };
    expect(applyStoryText(puzzle, good)?.title).toBe(good.en.title);
    expect(applyStoryText(puzzle, { ...good, fr: good.en })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, ca: undefined })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, es: { ...good.es, hints: [] } })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, en: { title: "git cherry-pick c1", description: "Story" } })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, en: { ...good.en, description: "See https://example.com" } })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, en: { ...good.en, description: "Story\ncontinues" } })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, en: { title: "<strong>Portrait</strong>", description: "A portrait is ready." } })).toBeUndefined();
    expect(applyStoryText(puzzle, { ...good, en: { ...good.en, title: "x".repeat(DEFAULT_PUZZLE_LIMITS.maxTitleLength + 1) } })).toBeUndefined();
  });

  it("changes only story text and returned localization fields", () => {
    const puzzle = candidate();
    const before = structuredClone(puzzle);
    const output = applyStoryText(puzzle, {
      en: { title: "Studio portrait", description: "A portrait is ready for display." },
      ca: { title: "Retrat d'estudi", description: "Un retrat està a punt per exposar." },
      es: { title: "Retrato de estudio", description: "Un retrato está listo para exponer." },
    });
    expect(output).toBeDefined();
    expect(puzzle).toEqual(before);
    expect(output?.initialRepository).toEqual(before.initialRepository);
    expect(output?.target).toEqual(before.target);
    expect(output?.solutionCommands).toEqual(before.solutionCommands);
    expect(output?.allowedCommands).toEqual(before.allowedCommands);
    expect(output?.objectives).toEqual(before.objectives);
    expect(output?.hints).toEqual(before.hints);
  });
});
