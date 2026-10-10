import type { SupabaseClient } from "@supabase/supabase-js";
import { GUIDED_GOAL_MAX_LENGTH } from "../puzzles/generation/guided";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import type { PublicPuzzleDefinition } from "../puzzles/types";
import { getSupabaseClient } from "./supabase";

export { GUIDED_GOAL_MAX_LENGTH };

export interface GuidedLessonRequest {
  /** The learner's own words: a topic, a command, or a goal. Plain data, never instructions. */
  goal: string;
}

export interface GuidedLesson {
  id: string;
  goal: string;
  puzzle: PublicPuzzleDefinition;
  /** What the practice covers, chosen by the server from the goal. */
  topic?: string;
  /** False when the generator fell back to a ready-made puzzle of the same level. */
  personalized?: boolean;
  createdAt?: string;
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

/** Without Supabase configured, every request fails politely. */
export class ComingSoonGuidedLessonService implements GuidedLessonService {
  async generate(): Promise<GuidedLesson> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    throw new GuidedLessonError("Personalised puzzles are coming soon. Continue with your lessons for now.");
  }
}

export class SupabaseGuidedLessonService implements GuidedLessonService {
  constructor(private readonly client: SupabaseClient) {}

  async generate({ goal }: GuidedLessonRequest): Promise<GuidedLesson> {
    const { data, error } = await this.client.functions.invoke("generate-guided-lesson", { body: { goal } });
    if (error) throw new GuidedLessonError(await friendlyMessage(error));

    const parsed = parsePublicPuzzleDefinition(data?.puzzle);
    if (!parsed.puzzle || typeof data?.id !== "string") {
      throw new GuidedLessonError("We couldn't build your puzzle. Please try again.");
    }
    const lesson: GuidedLesson = {
      id: data.id,
      goal: typeof data.goal === "string" ? data.goal : goal,
      topic: typeof data.topic === "string" ? data.topic : undefined,
      personalized: data.personalized !== false,
      puzzle: parsed.puzzle,
      createdAt: new Date().toISOString(),
    };
    saveGuidedLesson(lesson);
    return lesson;
  }
}

/** The Edge Function answers errors with `{ error }` written for the learner. */
async function friendlyMessage(error: { message?: string; context?: unknown }): Promise<string> {
  const context = error.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (typeof body?.error === "string" && body.error.length <= 200) return body.error;
    } catch {
      // Fall through to the generic message.
    }
    if (context.status === 401) return "Sign in to build a personalised puzzle.";
    if (context.status === 429) return "You've built a lot of puzzles recently. Try again a little later.";
  }
  return "We couldn't reach the puzzle builder. Check your connection and try again.";
}

const CACHE_KEY = "gitgud:guided-lessons:v1";
const CACHE_LIMIT = 20;

/** Generated practice is cached on the device so refreshes and replays keep working offline. */
export function saveGuidedLesson(lesson: GuidedLesson) {
  try {
    const others = readCache().filter((entry) => entry.id !== lesson.id);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify([lesson, ...others].slice(0, CACHE_LIMIT)));
  } catch {
    // The puzzle is still playable in this session without storage.
  }
}

export function loadGuidedLesson(id: string): GuidedLesson | undefined {
  return readCache().find((lesson) => lesson.id === id);
}

export function listGuidedLessons(): GuidedLesson[] {
  return readCache();
}

function readCache(): GuidedLesson[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): GuidedLesson[] => {
      if (typeof entry?.id !== "string" || typeof entry.goal !== "string") return [];
      const parsed = parsePublicPuzzleDefinition(entry.puzzle);
      return parsed.puzzle ? [{ ...entry, puzzle: parsed.puzzle }] : [];
    });
  } catch {
    return [];
  }
}

function createGuidedLessonService(): GuidedLessonService {
  const client = getSupabaseClient();
  return client ? new SupabaseGuidedLessonService(client) : new ComingSoonGuidedLessonService();
}

export const guidedLessonService: GuidedLessonService = createGuidedLessonService();
