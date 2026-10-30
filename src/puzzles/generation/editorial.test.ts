import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "../chickenCoronation";
import { applyStoryText, createTemplateLocalizations, refreshTemplateHints } from "./editorial";
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
      expect(first[locale].hints.join(" ")).toContain(puzzle.solutionCommands[0]);
      expect(first[locale].hints.join(" ")).not.toContain(puzzle.solutionCommands[1]);
      expect(first[locale].hints.join(" ").toLowerCase()).not.toContain("private proof");
    }
    expect(first.en.description).not.toMatch(/\bA a\b/i);
    expect(first.en.commitMessages.b22).toContain("sunglasses");
  });

  it("uses mechanics-specific guidance and distinguishes commit refs from branch refs", () => {
    const puzzle = candidate();
    puzzle.solutionCommands = ["git merge style"];
    const branchHint = createTemplateLocalizations(puzzle, "branch-only", "seed").en.hints[0];
    expect(branchHint).not.toContain("commit style");
    expect(branchHint).toContain("branch");
    const dependency = candidate();
    dependency.initialRepository.commits.s14.parents = ["b22"];
    dependency.solutionCommands = ["git cherry-pick b22", "git cherry-pick s14"];
    const dependentHint = createTemplateLocalizations(dependency, "dependency-family", "seed").en.hints[0];
    expect(dependentHint).toContain("depend on an earlier value");
  });

  it("describes prepare-and-integrate and bundled cleanup without hiding useful branch work", () => {
    const puzzle = candidate();
    puzzle.solutionCommands = ["git switch feature", "git revert b22", "git switch main", "git merge feature"];
    const integration = createTemplateLocalizations(puzzle, "prepare-and-integrate", "seed").en.hints;
    expect(integration[0]).toContain("prepare work on another branch before integrating it");
    expect(integration[0]).toContain("unwanted change");
    expect(integration.join(" ")).toContain("One route starts with git switch feature, then git revert b22");
  });

  it("leads with something concrete and never spends a hint on comparing main with the target", () => {
    const hints = createTemplateLocalizations(candidate(), "repair-family", "seed").en.hints;
    expect(hints[0]).toBe("Inspect the changes in commit b22 and compare them with the target.");
    expect(hints.join(" ")).not.toMatch(/compare main|across the branches/i);
  });

  it("states the route once and continues it with what each step does, in every locale", () => {
    const puzzle = candidate();
    const localized = createTemplateLocalizations(puzzle, "repair-family", "seed");
    expect(localized.en.hints[1]).toMatch(/^One route starts with git revert b22\. On main: sunglasses → /);
    expect(localized.ca.hints[1]).toMatch(/^Una ruta comença amb git revert b22\. A main: ulleres de sol → /);
    expect(localized.es.hints[1]).toMatch(/^Una ruta empieza con git revert b22\. En main: gafas de sol → /);
    for (const locale of ["en", "ca", "es"] as const) {
      expect(localized[locale].hints.join(" ")).not.toMatch(/only way|única|sola forma/i);
    }
    const long = createTemplateLocalizations({ ...puzzle, solutionCommands: ["git cherry-pick s14", "git switch main", "git revert b22", "git log"] }, "repair-family", "seed").en.hints;
    expect(long.join(" ")).toContain("One route starts with git cherry-pick s14");
  });

  it("keeps the final command out of the published hints and says what is left instead", () => {
    const puzzle = candidate();
    const hints = createTemplateLocalizations(puzzle, "repair-family", "seed").en.hints;
    expect(hints.at(-1)).toMatch(/^One last step finishes the route\. main still needs: /);
    expect(hints.join(" ")).not.toContain("git cherry-pick s14");
    const withTrailingSwitch = createTemplateLocalizations({ ...puzzle, solutionCommands: ["git revert b22", "git cherry-pick s14", "git switch main"] }, "repair-family", "seed").en.hints;
    expect(withTrailingSwitch.join(" ")).not.toContain("git cherry-pick s14");
    expect(withTrailingSwitch.join(" ")).not.toContain("git switch main");
  });

  it("ends the route at the first win", () => {
    const puzzle = candidate();
    const hints = createTemplateLocalizations({ ...puzzle, solutionCommands: ["git revert b22", "git cherry-pick s14", "git revert s14", "git cherry-pick s14"] }, "repair-family", "seed").en.hints;
    expect(hints.join(" ")).not.toContain("git revert s14");
    expect(hints.join(" ")).not.toContain("git cherry-pick s14");
  });

  it("fits a ten-command proof inside the hint limits", () => {
    const puzzle = candidate();
    const solutionCommands = Array.from({ length: 10 }, (_, index) => (index % 2 ? "git switch main" : "git cherry-pick s14"));
    const hints = createTemplateLocalizations({ ...puzzle, solutionCommands }, "dependency-family", "seed");
    for (const locale of ["en", "ca", "es"] as const) {
      expect(hints[locale].hints.length).toBeLessThanOrEqual(DEFAULT_PUZZLE_LIMITS.maxHints);
      for (const hint of hints[locale].hints) expect(hint.length).toBeLessThanOrEqual(DEFAULT_PUZZLE_LIMITS.maxHintLength);
    }
  });

  it("refreshes stored hints in every locale without touching the rest of the text", () => {
    const puzzle = candidate();
    const localizations = createTemplateLocalizations(puzzle, "repair-family", "seed");
    const stale: PuzzleCandidate = { ...puzzle, hints: ["Compare main with the target."], localizations: Object.fromEntries((["en", "ca", "es"] as const).map((locale) => [locale, { ...localizations[locale], hints: ["stale"] }])) as typeof localizations };
    const refreshed = refreshTemplateHints(stale, "repair-family");
    expect(refreshed.hints).toEqual(localizations.en.hints);
    expect(refreshed.localizations).toEqual(localizations);
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
