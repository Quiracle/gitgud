import { describe, expect, it } from "vitest";
import { validatePuzzleCandidate } from "../validateCandidate";
import { learnBasicsCatalog, getLearnBasicsLesson } from "./catalog";
import { learnBasicsSolutions } from "./privateSolutions";
import { CHICKEN_SEMANTIC_POLICY } from "./semanticPolicy";
import {
  LEARN_BASICS_LESSON_IDS,
  isAvailableLesson,
} from "./types";

describe("Learn Basics catalog", () => {
  it("contains ten stable, ordered lesson slots", () => {
    expect(learnBasicsCatalog.map((lesson) => lesson.id)).toEqual(
      LEARN_BASICS_LESSON_IDS,
    );
    expect(learnBasicsCatalog.map((lesson) => lesson.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(new Set(learnBasicsCatalog.map((lesson) => lesson.id)).size).toBe(10);
  });

  it("ships current commands and marks rebase-dependent lessons explicitly", () => {
    expect(learnBasicsCatalog.slice(0, 7).every(isAvailableLesson)).toBe(true);
    expect(learnBasicsCatalog.slice(7).map((lesson) => lesson.status)).toEqual([
      "coming-soon",
      "coming-soon",
      "coming-soon",
    ]);
  });

  it("validates every available lesson through the shared pipeline", () => {
    for (const lesson of learnBasicsCatalog) {
      if (!isAvailableLesson(lesson)) continue;
      const solutionCommands = learnBasicsSolutions[lesson.id];
      expect(solutionCommands, `${lesson.id} needs a private solution`).toBeDefined();

      const result = validatePuzzleCandidate(
        { ...structuredClone(lesson.puzzle), solutionCommands },
        { semantic: CHICKEN_SEMANTIC_POLICY },
      );

      expect(result, lesson.id).toMatchObject({ ok: true });
    }
  });

  it("keeps private solutions out of the player-facing catalog", () => {
    expect(JSON.stringify(learnBasicsCatalog)).not.toContain("solutionCommands");
  });

  it("distinguishes the featured command variants", () => {
    const logLesson = getLearnBasicsLesson("basics-01-inspect-history");
    const normalMerge = getLearnBasicsLesson("basics-03-fast-forward-merge");
    const ffOnlyMerge = getLearnBasicsLesson("basics-04-ff-only-merge");

    expect(logLesson?.status === "available" && logLesson.puzzle.actionRequirements).toEqual([
      { type: "log", all: false },
      { type: "log", all: true },
    ]);
    expect(normalMerge?.status === "available" && normalMerge.puzzle.actionRequirements).toEqual([
      { type: "merge", ffOnly: false },
    ]);
    expect(ffOnlyMerge?.status === "available" && ffOnlyMerge.puzzle.actionRequirements).toEqual([
      { type: "merge", ffOnly: true },
    ]);
  });
});
