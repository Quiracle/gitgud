import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "../i18n/runtime";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import type { PublicPuzzleDefinition } from "../puzzles/types";
import { requireSupabaseClient } from "./supabase";

export interface DailyPuzzleSource {
  getByDate(date: string): Promise<PublicPuzzleDefinition>;
}

const CACHE_PREFIX = "gitgud:daily:v1:";

export class FixtureDailyPuzzleSource implements DailyPuzzleSource {
  async getByDate(date: string) {
    return createDailyFixture(date);
  }
}

export class SupabaseDailyPuzzleSource implements DailyPuzzleSource {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Always asks for the date's current version first, so a corrected republication reaches
   * everyone on their next load. The local copy only covers an unreachable server.
   */
  async getByDate(date: string): Promise<PublicPuzzleDefinition> {
    let response;
    try {
      response = await this.client
        .from("daily_puzzles")
        .select("definition")
        .eq("published_on", date)
        .eq("is_current", true)
        .maybeSingle();
    } catch (reason) {
      response = { data: null, error: { message: reason instanceof Error ? reason.message : "network error" } };
    }
    const { data, error } = response;

    if (error) {
      const cached = readCache(date);
      if (cached) return cached;
      throw new Error(t("daily.unavailable"), { cause: error });
    }
    if (!data) throw new Error(t("daily.notPublished"));

    const parsed = parsePublicPuzzleDefinition(data.definition);
    if (!parsed.puzzle) throw new Error(t("daily.invalid"));
    writeCache(date, parsed.puzzle);
    return parsed.puzzle;
  }
}

export function createDailyPuzzleSource(): DailyPuzzleSource {
  const mode = import.meta.env.VITE_DAILY_PUZZLE_SOURCE ?? "fixture";
  if (mode === "fixture") return new FixtureDailyPuzzleSource();
  if (mode !== "supabase") throw new Error(`Unknown daily puzzle source '${mode}'.`);

  return new SupabaseDailyPuzzleSource(requireSupabaseClient());
}

export function utcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function readCache(date: string): PublicPuzzleDefinition | undefined {
  try {
    const value = window.localStorage.getItem(`${CACHE_PREFIX}${date}`);
    if (!value) return undefined;
    const parsed = parsePublicPuzzleDefinition(JSON.parse(value));
    if (parsed.puzzle?.publishedOn === date) return parsed.puzzle;
  } catch {
    // Corrupt or unavailable local storage is a cache miss.
  }
}

function writeCache(date: string, puzzle: PublicPuzzleDefinition) {
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${date}`, JSON.stringify(puzzle));
  } catch {
    // The published puzzle remains playable when storage is unavailable.
  }
}
