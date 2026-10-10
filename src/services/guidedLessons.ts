import type { PublicPuzzleDefinition } from "../puzzles/types";

/** Longest learning goal the prompt accepts. */
export const GUIDED_GOAL_MAX_LENGTH = 200;

export interface GuidedLessonRequest {
  /** The learner's own words: a topic, a command, or a goal. Plain data, never instructions. */
  goal: string;
}

export interface GuidedLesson {
  id: string;
  goal: string;
  puzzle: PublicPuzzleDefinition;
}

/**
 * Builds a personal practice puzzle from a learning goal. The real implementation calls
 * an authenticated, rate-limited Supabase Edge Function that reuses the daily generator's
 * schema and validation; the browser never talks to the AI provider.
 */
export interface GuidedLessonService {
  generate(request: GuidedLessonRequest): Promise<GuidedLesson>;
}

/** A friendly failure the prompt can show as-is. */
export class GuidedLessonError extends Error {}

/** Placeholder until the Edge Function exists: every request fails politely. */
export class ComingSoonGuidedLessonService implements GuidedLessonService {
  async generate(): Promise<GuidedLesson> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    throw new GuidedLessonError("Personalised puzzles are coming soon. Continue with your lessons for now.");
  }
}

export const guidedLessonService: GuidedLessonService = new ComingSoonGuidedLessonService();
