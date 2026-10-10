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

  complete(attempt: StoredAttempt, ranked: boolean): CompletionRecord {
    const completedAtMs = this.now();
    const startedAtMs = Date.parse(attempt.startedAt);
    const completion: CompletionRecord = {
      id: attempt.id,
      puzzleId: attempt.puzzleId,
      puzzleVersion: attempt.puzzleVersion,
      kind: attempt.kind,
      startedAt: attempt.startedAt,
      completedAt: new Date(completedAtMs).toISOString(),
      elapsedMs: Math.max(0, completedAtMs - startedAtMs),
      restartCount: attempt.restartCount,
      commandCount: attempt.commandCount,
      commands: attempt.commands,
      ranked,
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

  markCompletionRanked(completionId: string): void {
    const document = this.read();
    document.completions = document.completions.map((item) =>
      item.id === completionId ? { ...item, ranked: true } : item,
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

  /** Every saved completion, oldest first; replays add records and never remove them. */
  completions(): CompletionRecord[] {
    return this.read().completions;
  }

  private saveAttempt(attempt: StoredAttempt) {
    const document = this.read();
    document.activeAttempts[attemptKey(attempt.puzzleId, attempt.puzzleVersion)] = attempt;
    this.write(document);
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

export function browserProgressStore(): LocalProgressStore {
  return new LocalProgressStore(window.localStorage);
}

export function calculateStats(completions: readonly CompletionRecord[]): PlayerStats {
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
