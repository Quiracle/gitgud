import type { PuzzleCandidate, PuzzleDifficulty, PublicPuzzleDefinition } from "../types";
import { createGenerationBrief } from "./brief";
import type { GenerationBrief, GraphArchetype } from "./types";

/** Longest learner goal the guided generator accepts. Matches the prompt's input limit. */
export const GUIDED_GOAL_MAX_LENGTH = 200;
/** Guided practice teaches, so it always gets a ladder of hints. */
export const GUIDED_HINT_COUNT = 3;

export interface GuidedFocus {
  graphArchetype: GraphArchetype;
  difficulty: PuzzleDifficulty;
  /** Short, player-facing name of what the practice covers. */
  topic: string;
}

/**
 * Ordered most specific first. Matching runs in trusted code on the learner's text, so
 * their words pick a puzzle shape the engine supports but can never alter the brief itself.
 */
const FOCUS_RULES: { pattern: RegExp; focus: GuidedFocus }[] = [
  {
    pattern: /\b(everything|all of it|all commands|challenge|advanced|several branches|many branches|multiple branches)\b/,
    focus: { graphArchetype: "multi-branch-curation", difficulty: "hard", topic: "combining several branches" },
  },
  {
    pattern: /\b(revert|undo|undoing|back ?out|roll ?back|remove a commit|bad commit|mistake)/,
    focus: { graphArchetype: "curate-and-undo", difficulty: "medium", topic: "undoing a commit with git revert" },
  },
  {
    pattern: /\b(cherry|pick|copy|single commit|one commit|port)/,
    focus: { graphArchetype: "single-transfer", difficulty: "easy", topic: "copying one commit with git cherry-pick" },
  },
  {
    pattern: /\b(ff|fast[- ]?forward|ff-only|linear)/,
    focus: { graphArchetype: "fast-forward", difficulty: "easy", topic: "fast-forward merges" },
  },
  {
    pattern: /\b(merge|merging|diverg|combine|integrat|join|conflict|rebase|squash)/,
    focus: { graphArchetype: "divergent-merge", difficulty: "medium", topic: "merging diverged branches" },
  },
  {
    pattern: /\b(switch|switching|checkout|branch|branches|head|log|history)\b/,
    focus: { graphArchetype: "fast-forward", difficulty: "easy", topic: "moving between branches" },
  },
];

const DEFAULT_FOCUS: GuidedFocus = {
  graphArchetype: "divergent-merge",
  difficulty: "medium",
  topic: "branches and merging",
};

/** Cleans the learner's text into a single bounded line of plain data. */
export function normalizeGuidedGoal(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const goal = input.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!goal || goal.length > GUIDED_GOAL_MAX_LENGTH) return undefined;
  return goal;
}

export function classifyGuidedGoal(goal: string): GuidedFocus {
  const text = goal.toLowerCase();
  return FOCUS_RULES.find((rule) => rule.pattern.test(text))?.focus ?? DEFAULT_FOCUS;
}

/** The daily brief, pinned to the learner's focus. The date only anchors the seed. */
export function createGuidedBrief(goal: string, date: string, seed: string): { brief: GenerationBrief; focus: GuidedFocus } {
  const focus = classifyGuidedGoal(goal);
  const brief = createGenerationBrief(date, focus.difficulty, seed, {
    graphArchetype: focus.graphArchetype,
    hintCount: GUIDED_HINT_COUNT,
  });
  return { brief, focus };
}

/**
 * Turns a validated daily-shaped candidate into personal practice: a stable `guided-` ID,
 * kind "generated", no publication date, and the hidden solution split off.
 */
export function toGuidedPuzzle(
  candidate: PuzzleCandidate,
  lessonId: string,
): { puzzle: PublicPuzzleDefinition; solutionCommands: string[] } {
  const { solutionCommands, publishedOn: _publishedOn, ...rest } = candidate;
  const id = `guided-${lessonId}`;
  return {
    puzzle: { ...rest, id, slug: id, version: 1, kind: "generated" },
    solutionCommands,
  };
}
