import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TerminalEntry } from "../components/Puzzle/CommandPanel";
import { useAuth } from "../context/AuthContext";
import {
  executeCommand,
  formatInteractiveRebaseCommand,
  parseGitCommand,
  planInteractiveRebase,
  type GitAction,
  type InteractiveRebaseTodoEntry,
  type RebaseTodoItem,
  type Repository,
} from "../engine";
import { validatePuzzleCompletion, type PublicPuzzleDefinition } from "../puzzles";
import { startDailyAttempt, submitDailyResult } from "../services/leaderboard";
import { openProgressStore } from "../storage/browserProgress";
import type { CompletionRecord, LocalProgressStore, StoredAttempt } from "../storage/progress";

export type SessionStatus = "active" | "surrendered" | "completed";

/** Where a finished run stands with the daily leaderboard. */
export type SubmissionState = "guest" | "not-ranked" | "assisted" | "submitting" | "submitted" | "failed";

export interface CommandOutcome {
  ok: boolean;
  mutated: boolean;
  solved: boolean;
}

interface PendingRebase {
  onto: string;
  todo: InteractiveRebaseTodoEntry[];
}

/**
 * One attempt at a puzzle, persisted through the progress store so a refresh resumes
 * the same run and timer. Time is measured from the attempt's first start and never
 * resets on restart. Authenticated daily runs start a server attempt and submit the
 * result when solved; assisted runs are never ranked.
 */
export function usePuzzleSession(puzzle: PublicPuzzleDefinition) {
  const { status: authStatus, user } = useAuth();
  const [boot] = useState(() => {
    const store = openProgressStore();
    // A daily can be solved once: reopening it shows the solved run, read-only.
    const solved = puzzle.kind === "daily" ? store.latestCompletion(puzzle.id, puzzle.version) : undefined;
    if (solved) {
      const attempt = attemptFromCompletion(solved);
      const restored = restoreRun(puzzle, attempt);
      restored.entries.push({ id: restored.entries.length, lines: ["Puzzle solved!"], tone: "success" });
      return { store, attempt, restored, solved };
    }
    const attempt = store.start(puzzle);
    return { store, attempt, restored: restoreRun(puzzle, attempt), solved: undefined };
  });
  const store: LocalProgressStore = boot.store;

  const [attempt, setAttempt] = useState<StoredAttempt>(boot.attempt);
  const [repository, setRepository] = useState<Repository>(boot.restored.repository);
  const [entries, setEntries] = useState<TerminalEntry[]>(boot.restored.entries);
  const [actions, setActions] = useState<GitAction[]>(boot.restored.actions);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<SessionStatus>(boot.solved ? "completed" : "active");
  const [assisted, setAssisted] = useState(false);
  const [pendingRebase, setPendingRebase] = useState<PendingRebase | null>(null);
  const [completion, setCompletion] = useState<CompletionRecord | undefined>(boot.solved);
  const [submission, setSubmission] = useState<{ state: SubmissionState; error?: string }>({
    state: boot.solved?.ranked ? "submitted" : puzzle.kind === "daily" ? "guest" : "not-ranked",
  });
  /** Today's daily is already solved: show the result, but no more commands or restarts. */
  const locked = puzzle.kind === "daily" && status === "completed";
  const serverAttempt = useRef<Promise<string>>();

  const elapsedMs = useCallback(
    () => completion?.elapsedMs ?? Math.max(0, Date.now() - Date.parse(attempt.startedAt)),
    [attempt.startedAt, completion],
  );

  const validation = useMemo(
    () => validatePuzzleCompletion(repository, puzzle.target, actions, puzzle.actionRequirements),
    [actions, puzzle, repository],
  );

  // Signed-in daily players get a server-side start time for the ranked attempt.
  const ensureServerAttempt = useCallback((): Promise<string> => {
    if (attempt.serverAttemptId && user && attempt.serverUserId === user.id) return Promise.resolve(attempt.serverAttemptId);
    serverAttempt.current ??= startDailyAttempt(puzzle);
    return serverAttempt.current;
  }, [attempt.serverAttemptId, attempt.serverUserId, puzzle, user]);

  useEffect(() => {
    if (puzzle.kind !== "daily" || authStatus !== "authenticated" || !user || completion) return;
    if (attempt.serverAttemptId && attempt.serverUserId === user.id) return;
    ensureServerAttempt()
      .then((id) => setAttempt((current) => store.attachServerAttempt(current, id, user.id)))
      .catch((reason) =>
        setSubmission((current) => ({ ...current, error: reason instanceof Error ? reason.message : "Ranked attempt unavailable." })),
      );
  }, [attempt.serverAttemptId, attempt.serverUserId, authStatus, completion, ensureServerAttempt, puzzle.kind, store, user]);

  const submit = useCallback(
    async (finished: StoredAttempt, record: CompletionRecord, wasAssisted: boolean) => {
      if (puzzle.kind !== "daily") return setSubmission({ state: "not-ranked" });
      if (wasAssisted) return setSubmission({ state: "assisted" });
      if (authStatus !== "authenticated" || !user) return setSubmission({ state: "guest" });
      setSubmission({ state: "submitting" });
      try {
        const id =
          finished.serverAttemptId && finished.serverUserId === user.id ? finished.serverAttemptId : await ensureServerAttempt();
        await submitDailyResult(id, record);
        store.markCompletionRanked(record.id);
        setSubmission({ state: "submitted" });
      } catch (reason) {
        setSubmission({ state: "failed", error: reason instanceof Error ? reason.message : "Leaderboard submission failed." });
      }
    },
    [authStatus, ensureServerAttempt, puzzle.kind, store, user],
  );

  const record = useCallback((entry: Omit<TerminalEntry, "id">) => {
    setEntries((current) => [...current, { ...entry, id: current.length }]);
  }, []);

  const runCommand = useCallback(
    (command: string): CommandOutcome => {
      if (locked) return { ok: false, mutated: false, solved: true };
      const parsed = parseGitCommand(command);
      const allowed = !parsed.ok || puzzle.allowedCommands.includes(parsed.action.type);

      // An interactive rebase with commits to edit opens the todo dialog first.
      if (allowed && parsed.ok && parsed.action.type === "interactive-rebase" && !parsed.action.todo) {
        const plan = planInteractiveRebase(repository, parsed.action.onto);
        if (plan.ok && plan.todo.length > 0) {
          setPendingRebase({ onto: plan.onto, todo: plan.todo });
          return { ok: true, mutated: false, solved: validation.solved };
        }
      }

      const result = allowed
        ? executeCommand(repository, command)
        : {
            ok: false as const,
            repository,
            output: [`This puzzle doesn't use \`git ${command.split(/\s+/)[1] ?? "command"}\`.`, `Try: ${puzzle.allowedCommands.join(", ")}.`],
          };
      const nextActions = result.ok ? [...actions, result.action] : actions;
      const solved =
        result.ok &&
        validatePuzzleCompletion(result.repository, puzzle.target, nextActions, puzzle.actionRequirements).solved;

      const nextAttempt = store.recordCommand(
        attempt,
        { command, elapsedMs: Date.now() - Date.parse(attempt.startedAt), ok: result.ok, output: result.output.join("\n") },
        result.ok,
      );
      record({ command, lines: result.output, tone: result.ok ? "normal" : "error" });
      setActions(nextActions);
      setRepository(result.repository);
      setAttempt(nextAttempt);

      if (solved && !validation.solved) {
        record({ lines: ["Puzzle solved!"], tone: "success" });
        const done = store.complete(nextAttempt, false);
        setCompletion(done);
        setStatus("completed");
        void submit(nextAttempt, done, assisted);
      }
      return { ok: result.ok, mutated: result.ok && result.mutated, solved };
    },
    [actions, assisted, attempt, locked, puzzle, record, repository, store, submit, validation.solved],
  );

  const restart = useCallback(() => {
    if (locked) return;
    // After a solved lesson, a restart is a fresh replay attempt; earlier completions stay saved.
    const next = completion ? store.start(puzzle) : store.restart(attempt);
    if (completion) {
      serverAttempt.current = undefined;
      setCompletion(undefined);
      setSubmission({ state: puzzle.kind === "daily" ? "guest" : "not-ranked" });
    }
    setAttempt(next);
    setPendingRebase(null);
    setRepository(structuredClone(puzzle.initialRepository));
    setEntries([]);
    setActions([]);
    setStatus("active");
  }, [attempt, completion, locked, puzzle, store]);

  /** Reveals the next hint, counting it once. Returns undefined when none are left. */
  const takeHint = useCallback((): string | undefined => {
    const hint = puzzle.hints[hintsUsed];
    if (hint !== undefined) setHintsUsed((count) => count + 1);
    return hint;
  }, [hintsUsed, puzzle.hints]);

  const giveUp = useCallback(() => setStatus((current) => (current === "completed" ? current : "surrendered")), []);
  const resume = useCallback(() => setStatus((current) => (current === "surrendered" ? "active" : current)), []);

  /** Marks the run assisted: it can still be finished, but earns no points and isn't ranked. */
  const revealSolution = useCallback(() => setAssisted(true), []);

  const cancelRebase = useCallback(() => {
    if (!pendingRebase) return;
    const command = `git rebase -i ${pendingRebase.onto}`;
    const output = "Interactive rebase cancelled. Nothing changed.";
    setPendingRebase(null);
    setAttempt((current) =>
      store.recordCommand(current, { command, elapsedMs: Date.now() - Date.parse(current.startedAt), ok: false, output }, false),
    );
    record({ command, lines: [output] });
  }, [pendingRebase, record, store]);

  const confirmRebase = useCallback(
    (todo: RebaseTodoItem[]) => {
      if (!pendingRebase) return;
      setPendingRebase(null);
      runCommand(formatInteractiveRebaseCommand(pendingRebase.onto, todo));
    },
    [pendingRebase, runCommand],
  );

  return {
    repository,
    entries,
    validation,
    status,
    locked,
    /** Opened an already-solved daily (no celebration, just the result). */
    solvedOnArrival: Boolean(boot.solved),
    assisted,
    restartCount: attempt.restartCount,
    commandCount: attempt.commands.length - attempt.runTranscriptStart,
    hintsUsed,
    hintsTotal: puzzle.hints.length,
    pendingRebase,
    finalElapsedMs: completion?.elapsedMs,
    submission,
    elapsedMs,
    runCommand,
    restart,
    takeHint,
    giveUp,
    resume,
    revealSolution,
    cancelRebase,
    confirmRebase,
  };
}

export type PuzzleSession = ReturnType<typeof usePuzzleSession>;

/** A read-only attempt view of a finished run. Older records lack the final run, so replay its successful commands. */
function attemptFromCompletion(done: CompletionRecord): StoredAttempt {
  return {
    id: done.id,
    puzzleId: done.puzzleId,
    puzzleVersion: done.puzzleVersion,
    kind: done.kind,
    status: "active",
    startedAt: done.startedAt,
    restartCount: done.restartCount,
    commandCount: done.commandCount,
    commands: done.commands,
    runCommands: done.runCommands ?? done.commands.filter((entry) => entry.ok).map((entry) => entry.command),
    runTranscriptStart: done.runTranscriptStart ?? 0,
  };
}

/** Rebuilds a saved run by replaying its commands through the engine. */
function restoreRun(puzzle: PublicPuzzleDefinition, attempt: StoredAttempt) {
  let repository = structuredClone(puzzle.initialRepository);
  const actions: GitAction[] = [];
  for (const command of attempt.runCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok || !puzzle.allowedCommands.includes(parsed.action.type)) continue;
    const result = executeCommand(repository, command);
    repository = result.repository;
    if (result.ok) actions.push(result.action);
  }
  const entries: TerminalEntry[] = attempt.commands.slice(attempt.runTranscriptStart).map((entry, index) => ({
    id: index,
    command: entry.command,
    lines: entry.output ? entry.output.split("\n") : [],
    tone: entry.ok ? "normal" : "error",
  }));
  return { repository, actions, entries };
}
