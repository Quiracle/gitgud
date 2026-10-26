import type { PublicPuzzleDefinition } from "../puzzles";
import { clearGuestPlayer, markGuestSubmitted, readGuestPlayer, saveGuestName } from "../storage/guestPlayer";
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
  /** Ranked under a name chosen without an account. */
  isGuest: boolean;
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
    submitted_run_commands: completion.runCommands ?? completion.commands.filter((entry) => entry.ok).map((entry) => entry.command),
    submitted_run_transcript_start: completion.runTranscriptStart ?? 0,
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

/**
 * Claims every unranked, unassisted daily solve saved on this device. Failures stay claimable.
 * Once all are on the account, the guest name's entries are removed so nobody is listed twice.
 */
export async function claimGuestDailies(store: LocalProgressStore, userId: string): Promise<number> {
  const results = await Promise.allSettled(
    store.unrankedDailyCompletions().map((completion) => claimDailyCompletion(store, completion, userId)),
  );
  const guest = readGuestPlayer();
  if (guest && store.unrankedDailyCompletions().length === 0) {
    await forgetGuestPlayer(guest.token).then(() => clearGuestPlayer(), () => undefined);
  }
  return results.filter((result) => result.status === "fulfilled").length;
}

export const GUEST_NAME_MIN = 2;
export const GUEST_NAME_MAX = 24;
const GUEST_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'-]*$/u;

export type GuestNameCheck = { ok: true; name: string } | { ok: false; reason: "length" | "characters" };

/** Tidies a guest leaderboard name and checks it against the rules the server enforces. */
export function checkGuestName(input: string): GuestNameCheck {
  const name = input.trim().replace(/\s+/g, " ");
  const length = [...name].length;
  if (length < GUEST_NAME_MIN || length > GUEST_NAME_MAX) return { ok: false, reason: "length" };
  if (!GUEST_NAME_PATTERN.test(name)) return { ok: false, reason: "characters" };
  return { ok: true, name };
}

/** Ranks a guest's unassisted daily solve under their chosen name; the server keeps their best. */
export async function submitGuestDailyResult(token: string, displayName: string, completion: CompletionRecord): Promise<void> {
  if (completion.kind !== "daily" || completion.assisted) throw new Error("This solve can't be ranked.");
  const { error } = await requireSupabaseClient().rpc("submit_guest_daily_result", {
    guest_token: token,
    guest_name: displayName,
    target_puzzle_id: completion.puzzleId,
    target_puzzle_version: completion.puzzleVersion,
    submitted_elapsed_ms: completion.elapsedMs,
    submitted_restart_count: completion.restartCount,
    submitted_command_count: completion.commandCount,
    submitted_transcript: completion.commands,
  });
  if (error) throw new Error(`Leaderboard submission failed: ${error.message}`);
}

/** Saves the guest name on this device and ranks the solve under it. */
export async function joinDailyAsGuest(displayName: string, completion: CompletionRecord): Promise<void> {
  const player = saveGuestName(displayName);
  await submitGuestDailyResult(player.token, displayName, completion);
  markGuestSubmitted(completion.id);
}

/**
 * A finished daily this signed-out device could still put on the leaderboard under a
 * guest name: unassisted, not on an account, and not yet ranked under the guest name.
 */
export function canJoinAsGuest(completion: CompletionRecord | undefined): completion is CompletionRecord {
  if (!completion || completion.kind !== "daily" || completion.assisted || completion.ranked) return false;
  return !readGuestPlayer()?.submitted.includes(completion.id);
}

type RankedResult = Pick<LeaderboardEntry, "elapsedMs" | "restartCount" | "commandCount" | "completedAt">;

/** Where an unranked result would land among ranked entries (1-based), with the leaderboard's tie breakers. */
export function projectedRank(entries: readonly RankedResult[], result: RankedResult): number {
  return entries.filter((entry) => compareResults(entry, result) <= 0).length + 1;
}

function compareResults(a: RankedResult, b: RankedResult): number {
  return (
    a.elapsedMs - b.elapsedMs ||
    a.restartCount - b.restartCount ||
    a.commandCount - b.commandCount ||
    Date.parse(a.completedAt) - Date.parse(b.completedAt)
  );
}

/** Removes a guest name and all of its leaderboard entries. */
export async function forgetGuestPlayer(token: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("forget_guest_player", { guest_token: token });
  if (error) throw new Error(`Guest entries could not be removed: ${error.message}`);
}

export async function getDailyLeaderboard(
  puzzleId: string,
  puzzleVersion: number,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const args = { target_puzzle_id: puzzleId, target_puzzle_version: puzzleVersion, result_limit: limit };
  const guestToken = readGuestPlayer()?.token;
  const client = requireSupabaseClient();
  let { data, error } = await client.rpc("get_daily_leaderboard", guestToken ? { ...args, guest_token: guestToken } : args);
  // Until the guest leaderboard migration is applied, the RPC has no guest_token argument.
  if (error && guestToken && error.code === "PGRST202") ({ data, error } = await client.rpc("get_daily_leaderboard", args));
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
    isGuest: row.is_guest === true,
  };
}

export function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
