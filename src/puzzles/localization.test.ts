import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "./chickenCoronation";
import { executeCommand } from "../engine";
import { parsePuzzleCandidate } from "./schema";
import { localizePuzzle } from "./localization";
import { localizeRepository } from "./localization";
import { validatePuzzleCandidate } from "./validateCandidate";
import type { PuzzleLocalizations } from "./types";

const config = { semantic: { properties: {
  sunglasses: [false, true], hat: ["none", "blue"], scarf: ["none", "turquoise"], crest: ["none", "outline", "red"],
} } };
const entry = (title: string): PuzzleLocalizations["en"] => ({
  title, description: `${title}: story text.`, objectives: chickenCoronationPuzzle.objectives!,
  hints: ["Inspect the story."], commitMessages: { a10: "Start", b22: "Sunglasses", s14: "Scarf" },
});
const localizations: PuzzleLocalizations = {
  en: entry("The chicken's missing scarf"), ca: entry("El mocador que falta"), es: entry("Falta el pañuelo"),
};

function candidate(): Record<string, unknown> {
  return {
    ...structuredClone(chickenCoronationPuzzle),
    localizations: structuredClone(localizations),
    solutionCommands: ["git revert b22", "git cherry-pick s14"],
  };
}

describe("daily puzzle localization contract", () => {
  it("keeps legacy definitions valid and accepts complete localized copy", () => {
    expect(parsePuzzleCandidate({ ...candidate(), localizations: undefined }).candidate).toBeDefined();
    expect(parsePuzzleCandidate(candidate()).candidate?.localizations).toEqual(localizations);
    const validated = validatePuzzleCandidate(candidate(), config);
    expect(validated.ok, JSON.stringify(validated)).toBe(true);
  });

  it("rejects partial locale maps and unknown localized fields", () => {
    const partial = candidate();
    delete (partial.localizations as Record<string, unknown>).ca;
    expect(parsePuzzleCandidate(partial).issues.map((item) => item.code)).toContain("schema.missing-localization");
    const unknown = candidate();
    ((unknown.localizations as Record<string, Record<string, unknown>>).es).unexpected = "field";
    expect(parsePuzzleCandidate(unknown).issues.map((item) => item.code)).toContain("schema.unknown-property");
  });

  it("rejects oversized localized prose, count drift and changed commit identities", () => {
    const oversized = candidate();
    (((oversized.localizations as PuzzleLocalizations).ca).description) = "x".repeat(601);
    expect(validatePuzzleCandidate(oversized, config)).toMatchObject({ ok: false });
    const drift = candidate();
    (drift.localizations as PuzzleLocalizations).es.hints = [];
    expect(validatePuzzleCandidate(drift, config).ok).toBe(false);
    const missingCommit = candidate();
    delete (missingCommit.localizations as PuzzleLocalizations).en.commitMessages.s14;
    expect(validatePuzzleCandidate(missingCommit, config).ok).toBe(false);
  });

  it("changes display prose while keeping repository mechanics and identity intact", () => {
    const base = chickenCoronationPuzzle;
    const ca = localizePuzzle({ ...base, localizations }, "ca");
    const es = localizePuzzle({ ...base, localizations }, "es");
    expect(ca.title).toBe(localizations.ca.title);
    expect(es.title).toBe(localizations.es.title);
    expect(ca.id).toBe(base.id);
    expect(ca.version).toBe(base.version);
    expect(ca.initialRepository.branches).toEqual(base.initialRepository.branches);
    expect(ca.initialRepository.commits.s14.changes).toEqual(base.initialRepository.commits.s14.changes);
    expect(ca.target).toEqual(base.target);
    expect(ca.initialRepository.commits.s14.message).toBe("Scarf");
    expect(localizePuzzle(base, "ca")).toBe(base);
  });

  it("uses the selected locale for later command output without changing mechanics or earlier data", () => {
    const puzzle = {
      ...chickenCoronationPuzzle,
      localizations: {
        ...localizations,
        ca: { ...localizations.ca, commitMessages: { ...localizations.ca.commitMessages, s14: "Afegeix el mocador turquesa" } },
      },
    };
    const initialRepository = puzzle.initialRepository;
    const initialTarget = puzzle.target;
    const localized = localizeRepository(puzzle, initialRepository, "ca");
    const cherryPick = executeCommand(localized, "git cherry-pick s14");
    expect(cherryPick.ok).toBe(true);
    expect(cherryPick.output.join("\n")).toContain("Afegeix el mocador turquesa");
    if (!cherryPick.ok) return;
    const subsequentGraph = localizeRepository(puzzle, cherryPick.repository, "ca");
    expect(subsequentGraph.commits.s14.message).toBe("Afegeix el mocador turquesa");
    expect(subsequentGraph.commits.a10.parents).toEqual(initialRepository.commits.a10.parents);
    expect(subsequentGraph.branches).toEqual(cherryPick.repository.branches);
    expect(puzzle.initialRepository).toBe(initialRepository);
    expect(puzzle.target).toBe(initialTarget);
    expect(initialRepository.commits.s14.message).toBe("Add the turquoise ceremonial scarf");
  });
});
