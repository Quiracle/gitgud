import type { PublicPuzzleDefinition } from "../types";

export const LEARN_BASICS_LESSON_IDS = [
  "basics-01-inspect-history",
  "basics-02-switch-branches",
  "basics-03-fast-forward-merge",
  "basics-04-ff-only-merge",
  "basics-05-three-way-merge",
  "basics-06-cherry-pick",
  "basics-07-revert",
  "basics-08-rebase",
  "basics-09-interactive-rebase",
  "basics-10-capstone",
] as const;

export type LearnBasicsLessonId = typeof LEARN_BASICS_LESSON_IDS[number];

/** The explainer shown before a lesson starts. */
export interface LessonIntro {
  /** What the featured command does, in a sentence or two. */
  what: string;
  /** How it works, one short step per entry. */
  how: string[];
  /** What the player has to do in this lesson's puzzle. */
  task: string;
}

interface LessonSummary {
  id: LearnBasicsLessonId;
  order: number;
  title: string;
  summary: string;
  featuredCommands: string[];
  intro: LessonIntro;
}

export interface AvailableLesson extends LessonSummary {
  status: "available";
  puzzle: PublicPuzzleDefinition;
}

export interface ComingSoonLesson extends LessonSummary {
  status: "coming-soon";
  blockedBy: "rebase-engine";
}

export type LearnBasicsLesson = AvailableLesson | ComingSoonLesson;

export function isAvailableLesson(
  lesson: LearnBasicsLesson,
): lesson is AvailableLesson {
  return lesson.status === "available";
}
