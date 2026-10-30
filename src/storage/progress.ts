import type { PublicPuzzleDefinition } from "../puzzles";

export interface AttemptCommand {
  command: string;
  elapsedMs: number;
  ok: boolean;
  output: string;
}

export interface StoredAttempt {
  id: string;
  puzzleId: string;
  puzzleVersion: number;
  kind: PublicPuzzleDefinition["kind"];
  status: "active";
  startedAt: string;
  restartCount: number;
  commandCount: number;
  commands: AttemptCommand[];
  runCommands: string[];
  runTranscriptStart: number;
  serverAttemptId?: string;
  serverUserId?: string;
  /** The solution was revealed: the run can finish but is never ranked. Survives refresh and restart. */
  assisted?: boolean;
  /** The player gave up on a daily: the run ends on the revealed route, unsolved and unranked. */
  gaveUp?: boolean;
  /**
   * Time spent with the puzzle open and visible, banked every few seconds. Restarts never
   * reset it; closing the app or hiding the tab pauses it. Only ever grows.
   */
  activeMs?: number;
}

export interface CompletionRecord {
  id: string;
  puzzleId: string;
  puzzleVersion: number;
  kind: PublicPuzzleDefinition["kind"];
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  restartCount: number;
  commandCount: number;
  commands: AttemptCommand[];
  ranked: boolean;
  /** Ended by giving up, so it never counts as a solve. */
  gaveUp?: boolean;
  /** Account the solve was submitted for. Guest solves have none until claimed after login. */
  rankedUserId?: string;
  assisted?: boolean;
  /** The final run after any restarts, so a solved puzzle can be shown again. */
  runCommands?: string[];
  runTranscriptStart?: number;
}

export interface PlayerStats {
  completedRuns: number;
  completedPuzzles: number;
  completedDailies: number;
  completedLessons: number;
  bestElapsedMs?: number;
  totalRestarts: number;
  totalCommands: number;
}

interface ProgressDocument {
  schemaVersion: 1;
  activeAttempts: Record<string, StoredAttempt>;
  completions: CompletionRecord[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "gitgud:progress:v1";
const MAX_COMPLETIONS = 100;
const MAX_COMMANDS = 300;

export class LocalProgressStore {
  constructor(
    private readonly storage: StorageLike,
    private readonly now: () => number = Date.now,
    private readonly createId: () => string = defaultId,
  ) {}

  start(puzzle: PublicPuzzleDefinition): StoredAttempt {
    const document = this.read();
    const key = attemptKey(puzzle.id, puzzle.version);
    const existing = document.activeAttempts[key];
    if (existing) return existing;

    const attempt: StoredAttempt = {
      id: this.createId(),
      puzzleId: puzzle.id,
      puzzleVersion: puzzle.version,
      kind: puzzle.kind,
      status: "active",
      startedAt: new Date(this.now()).toISOString(),
      restartCount: 0,
      commandCount: 0,
      commands: [],
      runCommands: [],
      runTranscriptStart: 0,
    };
    document.activeAttempts[key] = attempt;
    this.write(document);
    return attempt;
  }

  recordCommand(
    attempt: StoredAttempt,
    entry: AttemptCommand,
    replayable = true,
  ): StoredAttempt {
    const next: StoredAttempt = {
      ...attempt,
      commandCount: attempt.commandCount + 1,
      commands: [...attempt.commands, sanitizeCommand(entry)].slice(-MAX_COMMANDS),
      runCommands: replayable ? [...attempt.runCommands, entry.command] : attempt.runCommands,
    };
    this.saveAttempt(next);
    return next;
  }

  restart(attempt: StoredAttempt): StoredAttempt {
    const next: StoredAttempt = {
      ...attempt,
      restartCount: attempt.restartCount + 1,
      runCommands: [],
      runTranscriptStart: Math.min(attempt.commands.length, MAX_COMMANDS),
    };
    this.saveAttempt(next);
    return next;
  }

  attachServerAttempt(
    attempt: StoredAttempt,
    serverAttemptId: string,
    serverUserId: string,
  ): StoredAttempt {
    const next = { ...attempt, serverAttemptId, serverUserId };
    this.saveAttempt(next);
    return next;
  }

  /** Ends a daily on the revealed route. The saved run replays as the finished tree on any later visit. */
  surrender(attempt: StoredAttempt, route: string[], elapsedMs: number): CompletionRecord {
    const steps = route.map((command) => ({ command, elapsedMs, ok: true, output: "" }));
    return this.complete({
      ...attempt,
      assisted: true,
      gaveUp: true,
      commands: [...attempt.commands, ...steps],
      commandCount: attempt.commands.length + steps.length,
      runCommands: route,
      runTranscriptStart: attempt.commands.length,
    }, false, elapsedMs);
  }

  markAssisted(attempt: StoredAttempt): StoredAttempt {
    const next: StoredAttempt = { ...attempt, assisted: true };
    this.saveAttempt(next);
    return next;
  }

  /** Banks active play time. Values lower than what is already saved are ignored. */
  setActiveMs(attempt: StoredAttempt, activeMs: number): StoredAttempt {
    const next: StoredAttempt = { ...attempt, activeMs: Math.max(activeMs, attempt.activeMs ?? 0) };
    return this.saveAttempt(next);
  }

  /** `elapsedMs` is the active play time; without it, the banked active time or legacy wall-clock time. */
  complete(attempt: StoredAttempt, ranked: boolean, elapsedMs?: number): CompletionRecord {
    const completedAtMs = this.now();
    const startedAtMs = Date.parse(attempt.startedAt);
    const saved = this.read().activeAttempts[attemptKey(attempt.puzzleId, attempt.puzzleVersion)];
    const banked = Math.max(attempt.activeMs ?? 0, saved?.id === attempt.id ? saved.activeMs ?? 0 : 0);
    const active = elapsedMs ?? (banked > 0 ? banked : undefined);
    const completion: CompletionRecord = {
      id: attempt.id,
      puzzleId: attempt.puzzleId,
      puzzleVersion: attempt.puzzleVersion,
      kind: attempt.kind,
      startedAt: attempt.startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      elapsedMs: Math.max(0, Math.round(active ?? completedAtMs - startedAtMs)),
      restartCount: attempt.restartCount,
      commandCount: attempt.commandCount,
      commands: attempt.commands,
      ranked,
      ...(attempt.assisted ? { assisted: true } : {}),
      ...(attempt.gaveUp ? { gaveUp: true } : {}),
      runCommands: attempt.runCommands,
      runTranscriptStart: attempt.runTranscriptStart,
    };

    const document = this.read();
    delete document.activeAttempts[attemptKey(attempt.puzzleId, attempt.puzzleVersion)];
    const withoutDuplicate = document.completions.filter((item) => item.id !== completion.id);
    document.completions = [...withoutDuplicate, completion].slice(-MAX_COMPLETIONS);
    this.write(document);
    return completion;
  }

  markCompletionRanked(completionId: string, userId?: string): void {
    const document = this.read();
    document.completions = document.completions.map((item) =>
      item.id === completionId ? { ...item, ranked: true, ...(userId ? { rankedUserId: userId } : {}) } : item,
    );
    this.write(document);
  }

  stats(): PlayerStats {
    return calculateStats(this.read().completions);
  }

  /** The latest saved completion of one puzzle version, if any. */
  latestCompletion(puzzleId: string, puzzleVersion: number): CompletionRecord | undefined {
    return this.read()
      .completions.filter((item) => item.puzzleId === puzzleId && item.puzzleVersion === puzzleVersion)
      .at(-1);
  }

  /** Unassisted daily solves not yet on any leaderboard, such as ones finished as a guest. */
  unrankedDailyCompletions(): CompletionRecord[] {
    return this.read().completions.filter((item) => item.kind === "daily" && !item.ranked && !item.assisted);
  }

  /** Every saved completion, oldest first; replays add records and never remove them. */
  completions(): CompletionRecord[] {
    return this.read().completions;
  }

  private saveAttempt(attempt: StoredAttempt): StoredAttempt {
    const document = this.read();
    const key = attemptKey(attempt.puzzleId, attempt.puzzleVersion);
    const saved = document.activeAttempts[key];
    // Active time only grows: a stale in-memory copy never rolls back banked time.
    const activeMs = Math.max(attempt.activeMs ?? 0, saved?.id === attempt.id ? saved.activeMs ?? 0 : 0);
    const next = activeMs > 0 ? { ...attempt, activeMs } : attempt;
    document.activeAttempts[key] = next;
    this.write(document);
    return next;
  }

  private read(): ProgressDocument {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return emptyDocument();
      const parsed = JSON.parse(raw) as Partial<ProgressDocument>;
      if (
        parsed.schemaVersion !== 1 ||
        !parsed.activeAttempts ||
        typeof parsed.activeAttempts !== "object" ||
        !Array.isArray(parsed.completions)
      ) {
        return emptyDocument();
      }
      return parsed as ProgressDocument;
    } catch {
      return emptyDocument();
    }
  }

  private write(document: ProgressDocument) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(document));
    } catch {
      // A storage quota or privacy-mode failure must never block the puzzle.
    }
  }
}

/**
 * Active play time already banked for an attempt. Attempts started before active timing
 * existed use their last command time, the best record of when the player was playing.
 */
export function bankedActiveMs(attempt: StoredAttempt): number {
  return attempt.activeMs ?? attempt.commands.at(-1)?.elapsedMs ?? 0;
}

export function browserProgressStore(): LocalProgressStore {
  return new LocalProgressStore(window.localStorage);
}

export function calculateStats(records: readonly CompletionRecord[]): PlayerStats {
  const completions = records.filter((item) => !item.gaveUp);
  const puzzleKeys = new Set(completions.map((item) => attemptKey(item.puzzleId, item.puzzleVersion)));
  const elapsed = completions.map((item) => item.elapsedMs);
  return {
    completedRuns: completions.length,
    completedPuzzles: puzzleKeys.size,
    completedDailies: new Set(
      completions
        .filter((item) => item.kind === "daily")
        .map((item) => attemptKey(item.puzzleId, item.puzzleVersion)),
    ).size,
    completedLessons: new Set(
      completions
        .filter((item) => item.kind === "lesson")
        .map((item) => attemptKey(item.puzzleId, item.puzzleVersion)),
    ).size,
    ...(elapsed.length ? { bestElapsedMs: Math.min(...elapsed) } : {}),
    totalRestarts: completions.reduce((sum, item) => sum + item.restartCount, 0),
    totalCommands: completions.reduce((sum, item) => sum + item.commandCount, 0),
  };
}

function sanitizeCommand(entry: AttemptCommand): AttemptCommand {
  return {
    command: entry.command.slice(0, 500),
    elapsedMs: Math.max(0, Math.floor(entry.elapsedMs)),
    ok: entry.ok,
    output: entry.output.slice(0, 2_000),
  };
}

function attemptKey(puzzleId: string, puzzleVersion: number): string {
  return `${puzzleId}:${puzzleVersion}`;
}

function emptyDocument(): ProgressDocument {
  return { schemaVersion: 1, activeAttempts: {}, completions: [] };
}

function defaultId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `attempt-${Date.now()}-${Math.random()}`;
}
