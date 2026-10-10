import type { AttemptCommand, CompletionRecord } from "../storage/progress";
import { requireSupabaseClient } from "./supabase";

interface ProgressRow {
  completed: unknown;
}

interface AttemptRow {
  id: unknown;
  puzzle_id: unknown;
  puzzle_version: unknown;
  started_at: unknown;
  completed_at: unknown;
  elapsed_ms: unknown;
  restart_count: unknown;
  command_count: unknown;
  assisted: unknown;
  transcript: unknown;
  run_commands: unknown;
  run_transcript_start: unknown;
}

/** Loads a completed daily and its final-run commands from the signed-in player's own records. */
export async function getSyncedDailyCompletion(
  puzzleId: string,
  puzzleVersion: number,
): Promise<CompletionRecord | undefined> {
  const client = requireSupabaseClient();
  const progress = await client
    .from("progress")
    .select("completed")
    .eq("puzzle_id", puzzleId)
    .eq("puzzle_version", puzzleVersion)
    .maybeSingle<ProgressRow>();
  if (progress.error) throw new Error(`Synced progress is unavailable: ${progress.error.message}`);
  if (!progress.data?.completed) return undefined;

  const attempt = await client
    .from("attempts")
    .select("id,puzzle_id,puzzle_version,started_at,completed_at,elapsed_ms,restart_count,command_count,assisted,transcript,run_commands,run_transcript_start")
    .eq("puzzle_id", puzzleId)
    .eq("puzzle_version", puzzleVersion)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle<AttemptRow>();
  if (attempt.error) throw new Error(`Synced completion is unavailable: ${attempt.error.message}`);
  return attempt.data ? parseSyncedDailyCompletion(attempt.data) : undefined;
}

/** Converts only well-formed, user-owned database data into a local completion view. */
export function parseSyncedDailyCompletion(row: AttemptRow): CompletionRecord | undefined {
  if (
    typeof row.id !== "string" ||
    typeof row.puzzle_id !== "string" ||
    typeof row.puzzle_version !== "number" ||
    typeof row.started_at !== "string" ||
    typeof row.completed_at !== "string" ||
    typeof row.elapsed_ms !== "number" ||
    typeof row.restart_count !== "number" ||
    typeof row.command_count !== "number"
  ) return undefined;

  const commands = parseCommands(row.transcript);
  // Rows saved before final-run persistence can still be replayed when they had
  // no restart. New rows always use the exact saved final run.
  const runCommands = parseRunCommands(row.run_commands);
  const runTranscriptStart = typeof row.run_transcript_start === "number" && row.run_transcript_start >= 0
    ? Math.min(Math.floor(row.run_transcript_start), commands.length)
    : 0;

  return {
    id: row.id,
    puzzleId: row.puzzle_id,
    puzzleVersion: row.puzzle_version,
    kind: "daily",
    startedAt: row.started_at,
    completedAt: row.completed_at,
    elapsedMs: row.elapsed_ms,
    restartCount: row.restart_count,
    commandCount: row.command_count,
    commands,
    ranked: true,
    ...(row.assisted === true ? { assisted: true } : {}),
    runCommands: runCommands.length ? runCommands : commands.filter((entry) => entry.ok).map((entry) => entry.command),
    runTranscriptStart,
  };
}

function parseCommands(value: unknown): AttemptCommand[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const command = entry as Record<string, unknown>;
    if (
      typeof command.command !== "string" ||
      typeof command.elapsedMs !== "number" ||
      typeof command.ok !== "boolean" ||
      typeof command.output !== "string"
    ) return [];
    return [{ command: command.command, elapsedMs: command.elapsedMs, ok: command.ok, output: command.output }];
  });
}

function parseRunCommands(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((command): command is string => typeof command === "string") : [];
}
