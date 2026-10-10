import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDailyFixture } from "../puzzles/dailyFixture";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import type { PublicPuzzleDefinition } from "../puzzles/types";

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

  async getByDate(date: string): Promise<PublicPuzzleDefinition> {
    const cached = readCache(date);
    if (cached) return cached;

    const { data, error } = await this.client
      .from("daily_puzzles")
      .select("definition")
      .eq("published_on", date)
      .eq("is_current", true)
      .maybeSingle();

    if (error) throw new Error(`Daily puzzle service is unavailable: ${error.message}`);
    if (!data) throw new Error("Today's puzzle has not been published yet. Please try again shortly.");

    const parsed = parsePublicPuzzleDefinition(data.definition);
    if (!parsed.puzzle) throw new Error("Today's published puzzle is invalid. Please contact the organizer.");
    writeCache(date, parsed.puzzle);
    return parsed.puzzle;
  }
}

export function createDailyPuzzleSource(): DailyPuzzleSource {
  const mode = import.meta.env.VITE_DAILY_PUZZLE_SOURCE ?? "fixture";
  if (mode === "fixture") return new FixtureDailyPuzzleSource();
  if (mode !== "supabase") throw new Error(`Unknown daily puzzle source '${mode}'.`);

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and publishable key are required for the daily puzzle source.");
  return new SupabaseDailyPuzzleSource(createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }));
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
