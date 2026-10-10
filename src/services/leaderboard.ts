import type { PublicPuzzleDefinition } from "../puzzles";
import type { CompletionRecord, LocalProgressStore } from "../storage/progress";
import { requireSupabaseClient } from "./supabase";

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  avatarUrl?: string;
  elapsedMs: number;
  restartCount: number;
  commandCount: number;
  completedAt: string;
  isCurrentUser: boolean;
}

export interface SyncedDailyStats {
  completedDailies: number;
  bestElapsedMs?: number;
  bestRestartCount?: number;
  bestCommandCount?: number;
}

export async function startDailyAttempt(
  puzzle: Pick<PublicPuzzleDefinition, "id" | "version" | "kind">,
): Promise<string> {
  if (puzzle.kind !== "daily") throw new Error("Only daily puzzles have ranked attempts.");
  const { data, error } = await requireSupabaseClient().rpc("start_daily_attempt", {
    target_puzzle_id: puzzle.id,
    target_puzzle_version: puzzle.version,
  });
  if (error) throw new Error(`Ranked attempt could not be started: ${error.message}`);
  if (typeof data !== "string") throw new Error("Ranked attempt service returned an invalid ID.");
  return data;
}

export async function submitDailyResult(
  serverAttemptId: string,
  completion: CompletionRecord,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("submit_daily_result", {
    target_attempt_id: serverAttemptId,
    submitted_elapsed_ms: completion.elapsedMs,
    submitted_restart_count: completion.restartCount,
    submitted_command_count: completion.commandCount,
    submitted_transcript: completion.commands,
  });
  if (error) throw new Error(`Leaderboard submission failed: ${error.message}`);
}

const claims = new Map<string, Promise<void>>();

/**
 * Puts a finished daily (for example one solved as a guest) on the signed-in player's
 * leaderboard, then marks it ranked for that account. Concurrent calls for the same solve
 * share one submission; the server keeps the player's best result either way.
 */
export function claimDailyCompletion(store: LocalProgressStore, completion: CompletionRecord, userId: string): Promise<void> {
  if (completion.kind !== "daily" || completion.assisted) return Promise.reject(new Error("This solve can't be ranked."));
  const key = `${userId}:${completion.id}`;
  const existing = claims.get(key);
  if (existing) return existing;
  const claim = (async () => {
    const attemptId = await startDailyAttempt({ id: completion.puzzleId, version: completion.puzzleVersion, kind: "daily" });
    await submitDailyResult(attemptId, completion);
    store.markCompletionRanked(completion.id, userId);
  })().finally(() => claims.delete(key));
  claims.set(key, claim);
  return claim;
}

/** Claims every unranked, unassisted daily solve saved on this device. Failures stay claimable. */
export async function claimGuestDailies(store: LocalProgressStore, userId: string): Promise<number> {
  const results = await Promise.allSettled(
    store.unrankedDailyCompletions().map((completion) => claimDailyCompletion(store, completion, userId)),
  );
  return results.filter((result) => result.status === "fulfilled").length;
}

export async function getDailyLeaderboard(
  puzzleId: string,
  puzzleVersion: number,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await requireSupabaseClient().rpc("get_daily_leaderboard", {
    target_puzzle_id: puzzleId,
    target_puzzle_version: puzzleVersion,
    result_limit: limit,
  });
  if (error) throw new Error(`Leaderboard is unavailable: ${error.message}`);
  if (!Array.isArray(data)) return [];
  return data.map(parseEntry).filter((entry): entry is LeaderboardEntry => Boolean(entry));
}

export async function getSyncedDailyStats(): Promise<SyncedDailyStats> {
  const { data, error } = await requireSupabaseClient()
    .from("progress")
    .select("best_elapsed_ms,best_restart_count,best_command_count")
    .eq("completed", true);
  if (error) throw new Error(`Synced statistics are unavailable: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];
  const elapsed = rows
    .map((row) => row.best_elapsed_ms)
    .filter((value): value is number => typeof value === "number");
  const restarts = rows
    .map((row) => row.best_restart_count)
    .filter((value): value is number => typeof value === "number");
  const commands = rows
    .map((row) => row.best_command_count)
    .filter((value): value is number => typeof value === "number");

  return {
    completedDailies: rows.length,
    ...(elapsed.length ? { bestElapsedMs: Math.min(...elapsed) } : {}),
    ...(restarts.length ? { bestRestartCount: Math.min(...restarts) } : {}),
    ...(commands.length ? { bestCommandCount: Math.min(...commands) } : {}),
  };
}

function parseEntry(value: unknown): LeaderboardEntry | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  if (
    typeof row.rank !== "number" ||
    typeof row.display_name !== "string" ||
    typeof row.elapsed_ms !== "number" ||
    typeof row.restart_count !== "number" ||
    typeof row.command_count !== "number" ||
    typeof row.completed_at !== "string" ||
    typeof row.is_current_user !== "boolean"
  ) return undefined;
  return {
    rank: row.rank,
    displayName: row.display_name,
    ...(typeof row.avatar_url === "string" ? { avatarUrl: row.avatar_url } : {}),
    elapsedMs: row.elapsed_ms,
    restartCount: row.restart_count,
    commandCount: row.command_count,
    completedAt: row.completed_at,
    isCurrentUser: row.is_current_user,
  };
}

export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
