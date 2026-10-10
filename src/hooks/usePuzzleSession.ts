import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TerminalEntry } from "../components/Terminal/Terminal";
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

export type SessionStatus = "active" | "surrendered" | "completed";

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
 * One run of a puzzle: repository, transcript, retries, hints, and timing. Timing is
 * cumulative active time from the first start; it pauses while the page is hidden and
 * never resets on restart.
 */
export function usePuzzleSession(puzzle: PublicPuzzleDefinition) {
  const [repository, setRepository] = useState<Repository>(() => structuredClone(puzzle.initialRepository));
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [actions, setActions] = useState<GitAction[]>([]);
  const [restartCount, setRestartCount] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [status, setStatus] = useState<SessionStatus>("active");
  const [assisted, setAssisted] = useState(false);
  const [pendingRebase, setPendingRebase] = useState<PendingRebase | null>(null);
  const [finalElapsedMs, setFinalElapsedMs] = useState<number>();

  const clock = useRef({ accumulated: 0, since: Date.now() as number | null });
  const elapsedMs = useCallback(() => {
    const { accumulated, since } = clock.current;
    return accumulated + (since === null ? 0 : Date.now() - since);
  }, []);
  const pauseClock = useCallback(() => {
    clock.current = { accumulated: elapsedMs(), since: null };
  }, [elapsedMs]);
  const resumeClock = useCallback(() => {
    if (clock.current.since === null) clock.current.since = Date.now();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (status !== "active") return;
      if (document.hidden) pauseClock();
      else resumeClock();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [status, pauseClock, resumeClock]);

  const validation = useMemo(
    () => validatePuzzleCompletion(repository, puzzle.target, actions, puzzle.actionRequirements),
    [actions, puzzle, repository],
  );

  const record = useCallback((entry: Omit<TerminalEntry, "id">) => {
    setEntries((current) => [...current, { ...entry, id: current.length }]);
  }, []);

  const runCommand = useCallback(
    (command: string): CommandOutcome => {
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

      record({ command, lines: result.output, tone: result.ok ? "normal" : "error" });
      setCommandCount((count) => count + 1);
      setActions(nextActions);
      setRepository(result.repository);

      if (solved && !validation.solved) {
        record({ lines: ["Puzzle solved!"], tone: "success" });
        setFinalElapsedMs(elapsedMs());
        pauseClock();
        setStatus("completed");
      }
      return { ok: result.ok, mutated: result.ok && result.mutated, solved };
    },
    [actions, elapsedMs, pauseClock, puzzle, record, repository, validation.solved],
  );

  const restart = useCallback(() => {
    setPendingRebase(null);
    setRepository(structuredClone(puzzle.initialRepository));
    setEntries([]);
    setActions([]);
    setCommandCount(0);
    setRestartCount((count) => count + 1);
    setFinalElapsedMs(undefined);
    setStatus("active");
    resumeClock();
  }, [puzzle, resumeClock]);

  /** Reveals the next hint, counting it once. Returns undefined when none are left. */
  const takeHint = useCallback((): string | undefined => {
    const hint = puzzle.hints[hintsUsed];
    if (hint !== undefined) setHintsUsed((count) => count + 1);
    return hint;
  }, [hintsUsed, puzzle.hints]);

  const giveUp = useCallback(() => {
    pauseClock();
    setStatus("surrendered");
  }, [pauseClock]);

  /** Backs out of giving up and carries on with the same run. */
  const resume = useCallback(() => {
    setStatus((current) => {
      if (current !== "surrendered") return current;
      resumeClock();
      return "active";
    });
  }, [resumeClock]);

  /** Marks the run assisted: it can still be finished, but earns no points. */
  const revealSolution = useCallback(() => setAssisted(true), []);

  const cancelRebase = useCallback(() => {
    if (!pendingRebase) return;
    setPendingRebase(null);
    setCommandCount((count) => count + 1);
    record({ command: `git rebase -i ${pendingRebase.onto}`, lines: ["Interactive rebase cancelled. Nothing changed."] });
  }, [pendingRebase, record]);

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
    assisted,
    restartCount,
    commandCount,
    hintsUsed,
    hintsTotal: puzzle.hints.length,
    pendingRebase,
    finalElapsedMs,
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
