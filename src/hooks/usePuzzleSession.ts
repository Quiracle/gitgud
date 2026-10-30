import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TerminalEntry } from "../components/Puzzle/CommandPanel";
import { useAuth } from "../context/AuthContext";
import { goalLabel } from "../i18n/goals";
import { useI18n } from "../i18n/I18nProvider";
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
import {
  localizeRepository,
  isPuzzleActionAllowed,
  validatePuzzleCompletion,
  type PublicPuzzleDefinition,
} from "../puzzles";
import {
  claimDailyCompletion,
  joinDailyAsGuest,
  startDailyAttempt,
  submitDailyResult,
  revealDailySolution,
} from "../services/leaderboard";
import { routeThroughFirstWin } from "../puzzles/solutionRoute";
import { isSupabaseConfigured } from "../services/supabase";
import { openProgressStore } from "../storage/browserProgress";
import { readGuestPlayer } from "../storage/guestPlayer";
import { bankedActiveMs, type CompletionRecord, type LocalProgressStore, type StoredAttempt } from "../storage/progress";

export type SessionStatus = "active" | "surrendered" | "completed";

/**
 * Where a finished run stands with the daily leaderboard. "guest" waits for a guest name
 * or a sign-in; "guest-submitted" is ranked under the guest name until the player signs in.
 */
export type SubmissionState =
  | "guest"
  | "guest-submitted"
  | "not-ranked"
  | "assisted"
  | "submitting"
  | "submitted"
  | "failed";

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
export function usePuzzleSession(puzzle: PublicPuzzleDefinition, syncedCompletion?: CompletionRecord) {
  const { status: authStatus, user } = useAuth();
  const i18n = useI18n();
  const [boot] = useState(() => {
    const store = openProgressStore();
    // A daily can be solved once: reopening it shows the solved run, read-only.
    const solved = puzzle.kind === "daily" ? syncedCompletion ?? store.latestCompletion(puzzle.id, puzzle.version) : undefined;
    if (solved) {
      const attempt = attemptFromCompletion(solved);
      const restored = restoreRun(puzzle, attempt);
      restored.entries.push({ id: restored.entries.length, lines: [i18n.t("terminal.solved")], tone: "success" });
      return { store, attempt, restored, solved };
    }
    const attempt = store.start(puzzle);
    const restored = restoreRun(puzzle, attempt);
    // A saved daily can meet the corrected state-only rule after an upgrade.
    // Complete it once using its accumulated active time, without touching prior results.
    if (puzzle.kind === "daily" && validatePuzzleCompletion(puzzle, restored.repository, restored.actions).solved) {
      const solved = store.complete(attempt, false, bankedActiveMs(attempt));
      restored.entries.push({ id: restored.entries.length, lines: [i18n.t("terminal.solved")], tone: "success" });
      return { store, attempt, restored, solved };
    }
    return { store, attempt, restored, solved: undefined };
  });
  const store: LocalProgressStore = boot.store;

  const [attempt, setAttempt] = useState<StoredAttempt>(boot.attempt);
  const [repository, setRepository] = useState<Repository>(boot.restored.repository);
  const [entries, setEntries] = useState<TerminalEntry[]>(boot.restored.entries);
  const [actions, setActions] = useState<GitAction[]>(boot.restored.actions);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<SessionStatus>(boot.solved ? "completed" : "active");
  const [assisted, setAssisted] = useState(Boolean(boot.attempt.assisted || boot.solved?.assisted));
  const [pendingRebase, setPendingRebase] = useState<PendingRebase | null>(null);
  const [completion, setCompletion] = useState<CompletionRecord | undefined>(boot.solved);
  const [submission, setSubmission] = useState<{ state: SubmissionState; error?: string }>(() => ({
    state: boot.solved?.ranked
      ? "submitted"
      : boot.solved?.assisted
        ? "assisted"
        : puzzle.kind !== "daily"
          ? "not-ranked"
          : boot.solved && readGuestPlayer()?.submitted.includes(boot.solved.id)
            ? "guest-submitted"
            : "guest",
  }));
  /** The name this device's guest uses on leaderboards, once chosen. */
  const [guestName, setGuestName] = useState(() => readGuestPlayer()?.displayName);
  /** Today's daily is already solved: show the result, but no more commands or restarts. */
  const locked = puzzle.kind === "daily" && status === "completed";
  const serverAttempt = useRef<Promise<string>>();

  // Active play time: it only runs while this puzzle is open, visible, and in play.
  const banked = useRef(bankedActiveMs(boot.attempt));
  const openSince = useRef<number | null>(null);
  const activeMs = useCallback(
    () => Math.round(banked.current + (openSince.current === null ? 0 : Date.now() - openSince.current)),
    [],
  );
  const bank = useCallback(() => {
    if (openSince.current === null) return;
    const now = Date.now();
    banked.current += now - openSince.current;
    openSince.current = now;
    const total = Math.round(banked.current);
    setAttempt((current) => store.setActiveMs(current, total));
  }, [store]);

  const running = status === "active" && !completion;
  useEffect(() => {
    if (!running) return;
    const resume = () => {
      if (document.visibilityState === "visible" && openSince.current === null) openSince.current = Date.now();
    };
    const pause = () => {
      bank();
      openSince.current = null;
    };
    const onVisibility = () => (document.visibilityState === "visible" ? resume() : pause());
    resume();
    // Bank regularly so a crash or a killed tab loses at most a few seconds.
    const heartbeat = window.setInterval(bank, 5_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", pause);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pause);
      pause();
    };
  }, [bank, running]);

  const elapsedMs = useCallback(() => completion?.elapsedMs ?? activeMs(), [activeMs, completion]);

  const validation = useMemo(
    () => validatePuzzleCompletion(puzzle, repository, actions),
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

  /** Ranks a guest's solve under their name. A failure keeps the name form open to retry. */
  const submitAsGuest = useCallback(async (record: CompletionRecord, name: string) => {
    setSubmission({ state: "submitting" });
    try {
      setGuestName(name);
      await joinDailyAsGuest(name, record);
      setSubmission({ state: "guest-submitted" });
    } catch (reason) {
      setSubmission({ state: "guest", error: reason instanceof Error ? reason.message : "Leaderboard submission failed." });
    }
  }, []);

  /** Puts the finished daily on the leaderboard under a guest name, without signing in. */
  const joinAsGuest = useCallback(
    (name: string) => {
      if (!completion || completion.assisted || puzzle.kind !== "daily" || authStatus === "authenticated") return;
      void submitAsGuest(completion, name);
    },
    [authStatus, completion, puzzle.kind, submitAsGuest],
  );

  const submit = useCallback(
    async (finished: StoredAttempt, record: CompletionRecord, wasAssisted: boolean) => {
      if (puzzle.kind !== "daily") return setSubmission({ state: "not-ranked" });
      if (wasAssisted) return setSubmission({ state: "assisted" });
      if (authStatus !== "authenticated" || !user) {
        // A guest who already picked a name joins every daily they solve under it.
        const name = readGuestPlayer()?.displayName;
        if (name && isSupabaseConfigured()) return submitAsGuest(record, name);
        return setSubmission({ state: "guest" });
      }
      setSubmission({ state: "submitting" });
      try {
        const id =
          finished.serverAttemptId && finished.serverUserId === user.id ? finished.serverAttemptId : await ensureServerAttempt();
        await submitDailyResult(id, record);
        store.markCompletionRanked(record.id, user.id);
        setSubmission({ state: "submitted" });
      } catch (reason) {
        setSubmission({ state: "failed", error: reason instanceof Error ? reason.message : "Leaderboard submission failed." });
      }
    },
    [authStatus, ensureServerAttempt, puzzle.kind, store, submitAsGuest, user],
  );

  // A daily solved as a guest moves to the player's account as soon as they sign in.
  useEffect(() => {
    if (submission.state !== "guest" && submission.state !== "guest-submitted") return;
    if (!completion || completion.ranked || completion.assisted) return;
    if (puzzle.kind !== "daily" || authStatus !== "authenticated" || !user) return;
    // The app-wide sign-in claim may already have submitted it.
    if (store.completions().some((item) => item.id === completion.id && item.ranked)) {
      setCompletion({ ...completion, ranked: true });
      setSubmission({ state: "submitted" });
      return;
    }
    setSubmission({ state: "submitting" });
    claimDailyCompletion(store, completion, user.id)
      .then(() => {
        setCompletion((current) => (current?.id === completion.id ? { ...current, ranked: true, rankedUserId: user.id } : current));
        setSubmission({ state: "submitted" });
      })
      .catch((reason) =>
        setSubmission({ state: "failed", error: reason instanceof Error ? reason.message : "Leaderboard submission failed." }),
      );
  }, [authStatus, completion, puzzle.kind, store, submission.state, user]);

  const record = useCallback((entry: Omit<TerminalEntry, "id">) => {
    setEntries((current) => [...current, { ...entry, id: current.length }]);
  }, []);

  const runCommand = useCallback(
    (command: string): CommandOutcome => {
      if (locked) return { ok: false, mutated: false, solved: true };
      const parsed = parseGitCommand(command);
      if (parsed.ok && !isPuzzleActionAllowed(puzzle, parsed.action)) {
        const output = i18n.t("terminal.commandNotAllowed", { command: parsed.action.type });
        const nextAttempt = store.recordCommand(
          attempt,
          { command, elapsedMs: activeMs(), ok: false, output },
          false,
        );
        record({ command, lines: [output], tone: "error" });
        setAttempt(nextAttempt);
        return { ok: false, mutated: false, solved: false };
      }

      // An interactive rebase with commits to edit opens the todo dialog first.
      if (parsed.ok && parsed.action.type === "interactive-rebase" && !parsed.action.todo) {
        const plan = planInteractiveRebase(localizeRepository(puzzle, repository, i18n.locale), parsed.action.onto);
        if (plan.ok && plan.todo.length > 0) {
          setPendingRebase({ onto: plan.onto, todo: plan.todo });
          return { ok: true, mutated: false, solved: validation.solved };
        }
      }

      // Localize original messages for new command results without mutating the live canonical state.
      const result = executeCommand(localizeRepository(puzzle, repository, i18n.locale), command);
      const nextActions = result.ok ? [...actions, result.action] : actions;
      const next = result.ok
        ? validatePuzzleCompletion(puzzle, result.repository, nextActions)
        : validation;
      const solved = result.ok && next.solved;

      const nextAttempt = store.recordCommand(
        attempt,
        { command, elapsedMs: activeMs(), ok: result.ok, output: result.output.join("\n") },
        result.ok,
      );
      record({ command, lines: result.output, tone: result.ok ? "normal" : "error" });
      // Lessons can intentionally keep teaching/history goals open after their snapshot matches.
      if (result.ok && result.mutated && !solved && next.checks.find((check) => check.id === "snapshot")?.met) {
        const open = next.checks.filter((check) => !check.met).map((check) => `  - ${goalLabel(check, i18n)}`);
        record({
          lines: [i18n.t("terminal.requirementsOpen"), ...open, i18n.t("terminal.tapGoal")],
          tone: "info",
        });
      }
      setActions(nextActions);
      setRepository(result.repository);
      setAttempt(nextAttempt);

      if (solved && !validation.solved) {
        record({ lines: [i18n.t("terminal.solved")], tone: "success" });
        // Stop the clock first, so nothing banks into the finished attempt.
        const finalMs = activeMs();
        openSince.current = null;
        const done = store.complete(nextAttempt, false, finalMs);
        setCompletion(done);
        setStatus("completed");
        void submit(nextAttempt, done, assisted);
      }
      return { ok: result.ok, mutated: result.ok && result.mutated, solved };
    },
    [actions, activeMs, assisted, attempt, i18n, locked, puzzle, record, repository, store, submit, validation.solved],
  );

  const restart = useCallback(() => {
    if (locked) return;
    // After a solved lesson, a restart is a fresh replay attempt; earlier completions stay saved.
    const next = completion ? store.start(puzzle) : store.restart(attempt);
    // A replay after a solve is a new attempt with its own clock; a restart keeps it running.
    if (completion) banked.current = bankedActiveMs(next);
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

  /**
   * Ends a daily for good: the tree is rebuilt on the shortest route and the run saved as given up.
   * Nothing changes unless the route arrives and wins, so a failure leaves the run playable.
   */
  const surrenderDaily = useCallback(async (): Promise<boolean> => {
    if (puzzle.kind !== "daily" || completion) return false;
    const finalMs = activeMs();
    try {
      const route = routeThroughFirstWin(
        puzzle,
        await revealDailySolution(puzzle, { elapsedMs: finalMs, restartCount: attempt.restartCount }),
      );
      if (!route) return false;
      openSince.current = null;
      const done = store.surrender(attempt, route, finalMs);
      const finished = attemptFromCompletion(done);
      const restored = restoreRun(puzzle, finished);
      setAttempt(finished);
      setRepository(restored.repository);
      setActions(restored.actions);
      setEntries(restored.entries);
      setPendingRebase(null);
      setAssisted(true);
      setCompletion(done);
      setSubmission({ state: "assisted" });
      setStatus("completed");
      return true;
    } catch {
      return false;
    }
  }, [activeMs, attempt, completion, puzzle, store]);

  /** Marks the run assisted: it can still be finished, but earns no points and isn't ranked. */
  const revealSolution = useCallback(() => {
    setAssisted(true);
    setAttempt((current) => store.markAssisted(current));
  }, [store]);

  const cancelRebase = useCallback(() => {
    if (!pendingRebase) return;
    const command = `git rebase -i ${pendingRebase.onto}`;
    const output = "Interactive rebase cancelled. Nothing changed.";
    setPendingRebase(null);
    setAttempt((current) =>
      store.recordCommand(current, { command, elapsedMs: activeMs(), ok: false, output }, false),
    );
    record({ command, lines: [output] });
  }, [activeMs, pendingRebase, record, store]);

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
    gaveUp: Boolean(completion?.gaveUp),
    /** The revealed route, once the player has given up. */
    solutionRoute: completion?.gaveUp ? completion.runCommands ?? [] : [],
    restartCount: attempt.restartCount,
    commandCount: attempt.commands.length - attempt.runTranscriptStart,
    hintsUsed,
    hintsTotal: puzzle.hints.length,
    pendingRebase,
    finalElapsedMs: completion?.elapsedMs,
    submission,
    guestName,
    joinAsGuest,
    elapsedMs,
    runCommand,
    restart,
    takeHint,
    giveUp,
    resume,
    surrenderDaily,
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

/**
 * Rebuilds a saved run by replaying its commands through the engine. Commands rejected by
 * the puzzle's allowlist are never saved as replayable, so saved commands are replayed as-is:
 * runs saved before a lesson allowlist was enforced must restore the same tree.
 */
function restoreRun(puzzle: PublicPuzzleDefinition, attempt: StoredAttempt) {
  let repository = structuredClone(puzzle.initialRepository);
  const actions: GitAction[] = [];
  for (const command of attempt.runCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) continue;
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
