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

  it("gives every lesson a different goal chicken, since it is the course cover", () => {
    const goals = learnBasicsCatalog.filter(isAvailableLesson).map((lesson) => JSON.stringify(lesson.puzzle.target.snapshot));
    expect(new Set(goals).size).toBe(goals.length);
  });

  it("ships every lesson as playable", () => {
    expect(learnBasicsCatalog.every(isAvailableLesson)).toBe(true);
  });

  it("accepts different capstone solutions that reach the same history invariants", () => {
    const capstone = getLearnBasicsLesson("basics-10-capstone");
    if (!capstone || !isAvailableLesson(capstone)) throw new Error("capstone missing");

    for (const solutionCommands of [
      ["git cherry-pick x21", "git merge feature", "git revert b20"],
      ["git cherry-pick f20", "git revert b20", "git cherry-pick x21"],
      [
        "git switch feature",
        "git rebase main",
        "git switch main",
        "git merge --ff-only feature",
        "git cherry-pick x21",
        "git revert b20",
      ],
    ]) {
      const result = validatePuzzleCandidate(
        { ...structuredClone(capstone.puzzle), solutionCommands },
        { semantic: CHICKEN_SEMANTIC_POLICY },
      );
      expect(result, solutionCommands.join("; ")).toMatchObject({ ok: true });
    }
  });

  it("rejects histories that miss the lesson's featured behavior", () => {
    const rebase = getLearnBasicsLesson("basics-08-rebase");
    const squash = getLearnBasicsLesson("basics-09-interactive-rebase");
    if (!rebase || !isAvailableLesson(rebase) || !squash || !isAvailableLesson(squash)) {
      throw new Error("rebase lessons missing");
    }

    expect(
      validatePuzzleCandidate(
        { ...structuredClone(rebase.puzzle), allowedCommands: ["log", "switch", "rebase", "merge"], solutionCommands: ["git merge main"] },
        { semantic: CHICKEN_SEMANTIC_POLICY },
      ),
    ).toMatchObject({ ok: false });
    expect(
      validatePuzzleCandidate(
        { ...structuredClone(squash.puzzle), solutionCommands: ["git rebase -i main"] },
        { semantic: CHICKEN_SEMANTIC_POLICY },
      ),
    ).toMatchObject({ ok: false });
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
