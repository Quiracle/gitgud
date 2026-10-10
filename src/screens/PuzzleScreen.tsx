import { useEffect, useMemo, useRef, useState } from "react";
import { AppLink } from "../components/AppLink";
import { GitGraph } from "../components/GitGraph/GitGraph";
import { GitLog } from "../components/GitLog/GitLog";
import { GoalPanel } from "../components/GoalPanel/GoalPanel";
import { ChickenIllustration } from "../components/Illustration/ChickenIllustration";
import { InteractiveRebaseDialog } from "../components/RebaseDialog/InteractiveRebaseDialog";
import { Terminal, type TerminalEntry } from "../components/Terminal/Terminal";
import { ResultModal, type SubmissionState } from "../components/ResultModal/ResultModal";
import { useAuth } from "../context/AuthContext";
import {
  executeCommand,
  formatInteractiveRebaseCommand,
  getSnapshot,
  parseGitCommand,
  planInteractiveRebase,
  type GitAction,
  type InteractiveRebaseTodoEntry,
  type Repository,
} from "../engine";
import {
  validatePuzzleCompletion,
  type PublicPuzzleDefinition,
} from "../puzzles";
import { startDailyAttempt, submitDailyResult } from "../services/leaderboard";
import {
  browserProgressStore,
  type CompletionRecord,
  type StoredAttempt,
} from "../storage/progress";

interface PuzzleScreenProps {
  puzzle: PublicPuzzleDefinition;
  eyebrow: string;
  backHref: string;
  backLabel: string;
  accent: "emerald" | "violet";
  onNavigate: (path: string) => void;
}

export function PuzzleScreen({
  puzzle,
  eyebrow,
  backHref,
  backLabel,
  accent,
  onNavigate,
}: PuzzleScreenProps) {
  const { status: authStatus, user } = useAuth();
  const [session] = useState(() => {
    const store = browserProgressStore();
    const attempt = store.start(puzzle);
    return { store, attempt, restored: restorePuzzleRun(puzzle, attempt) };
  });
  const [attempt, setAttempt] = useState<StoredAttempt>(session.attempt);
  const [repository, setRepository] = useState<Repository>(session.restored.repository);
  const [entries, setEntries] = useState<TerminalEntry[]>(session.restored.entries);
  const [actions, setActions] = useState<GitAction[]>(session.restored.actions);
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, Date.now() - Date.parse(session.attempt.startedAt)),
  );
  const [completion, setCompletion] = useState<CompletionRecord>();
  const [showResult, setShowResult] = useState(true);
  const [submissionState, setSubmissionState] = useState<SubmissionState>(
    puzzle.kind === "daily" ? "guest" : "not-ranked",
  );
  const [submissionError, setSubmissionError] = useState<string>();
  const completedRef = useRef(false);
  const serverAttemptPromise = useRef<Promise<string>>();
  const [pendingRebase, setPendingRebase] = useState<{
    onto: string;
    todo: InteractiveRebaseTodoEntry[];
  } | null>(null);

  const validation = useMemo(
    () =>
      validatePuzzleCompletion(
        repository,
        puzzle.target,
        actions,
        puzzle.actionRequirements,
      ),
    [actions, puzzle, repository],
  );
  const currentState = useMemo(() => getSnapshot(repository), [repository]);

  useEffect(() => {
    if (validation.solved) return;
    const startedAt = Date.parse(attempt.startedAt);
    const update = () => setElapsedMs(Math.max(0, Date.now() - startedAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [attempt.startedAt, validation.solved]);

  useEffect(() => {
    if (puzzle.kind !== "daily" || authStatus !== "authenticated" || !user) return;
    if (attempt.serverAttemptId && attempt.serverUserId === user.id) return;

    void ensureServerAttempt()
      .then((serverAttemptId) => {
        if (completedRef.current) return;
        setAttempt((current) => {
          const next = session.store.attachServerAttempt(current, serverAttemptId, user.id);
          return next;
        });
      })
      .catch((reason) => {
        setSubmissionError(reason instanceof Error ? reason.message : "Ranked attempt unavailable.");
      });
  }, [attempt.serverAttemptId, attempt.serverUserId, authStatus, puzzle.kind, user]);

  function ensureServerAttempt(): Promise<string> {
    if (attempt.serverAttemptId && user && attempt.serverUserId === user.id) {
      return Promise.resolve(attempt.serverAttemptId);
    }
    serverAttemptPromise.current ??= startDailyAttempt(puzzle);
    return serverAttemptPromise.current;
  }

  function runCommand(command: string) {
    const parsed = parseGitCommand(command);
    const commandAllowed = !parsed.ok || puzzle.allowedCommands.includes(parsed.action.type);

    // An interactive rebase with commits to edit opens the todo dialog first; the
    // edited todo list is then run as one command so the transcript can replay it.
    if (commandAllowed && parsed.ok && parsed.action.type === "interactive-rebase" && !parsed.action.todo) {
      const plan = planInteractiveRebase(repository, parsed.action.onto);
      if (plan.ok && plan.todo.length > 0) {
        setPendingRebase({ onto: plan.onto, todo: plan.todo });
        return;
      }
    }

    const result = commandAllowed
      ? executeCommand(repository, command)
      : {
          ok: false as const,
          repository,
          output: [
            `This lesson does not use \`git ${command.split(/\s+/)[1] ?? "command"}\`.`,
            `Allowed command types: ${puzzle.allowedCommands.join(", ")}.`,
          ],
          error: "Command not allowed in this lesson.",
        };
    const nextActions = result.ok ? [...actions, result.action] : actions;
    const nextValidation = validatePuzzleCompletion(
      result.repository,
      puzzle.target,
      nextActions,
      puzzle.actionRequirements,
    );
    const nextEntries: TerminalEntry[] = [
      ...entries,
      {
        id: entries.length,
        command,
        lines: result.output,
        tone: result.ok ? "normal" : "error",
      },
    ];

    const nextAttempt = session.store.recordCommand(attempt, {
      command,
      elapsedMs: Math.max(0, Date.now() - Date.parse(attempt.startedAt)),
      ok: result.ok,
      output: result.output.join("\n"),
    });

    if (!validation.solved && nextValidation.solved) {
      nextEntries.push({
        id: entries.length + 1,
        lines: ["Puzzle solved! Repository state, history, and lesson goals match."],
        tone: "success",
      });
      completedRef.current = true;
      const completed = session.store.complete(nextAttempt, false);
      setElapsedMs(completed.elapsedMs);
      setCompletion(completed);
      setShowResult(true);
      void submitCompletion(nextAttempt, completed);
    }

    setAttempt(nextAttempt);
    setEntries(nextEntries);
    setActions(nextActions);
    setRepository(result.repository);
  }

  function cancelRebase() {
    if (!pendingRebase) return;
    setPendingRebase(null);
    const command = `git rebase -i ${pendingRebase.onto}`;
    const output = "Interactive rebase cancelled. Nothing changed.";
    setAttempt(session.store.recordCommand(attempt, {
      command,
      elapsedMs: Math.max(0, Date.now() - Date.parse(attempt.startedAt)),
      ok: false,
      output,
    }, false));
    setEntries([
      ...entries,
      {
        id: entries.length,
        command,
        lines: [output],
      },
    ]);
  }

  function restartPuzzle() {
    if (validation.solved) {
      const replay = session.store.start(puzzle);
      completedRef.current = false;
      serverAttemptPromise.current = undefined;
      setCompletion(undefined);
      setShowResult(true);
      setSubmissionError(undefined);
      setSubmissionState(puzzle.kind === "daily" ? "guest" : "not-ranked");
      setPendingRebase(null);
      setRepository(structuredClone(puzzle.initialRepository));
      setEntries([welcomeEntry(puzzle)]);
      setActions([]);
      setAttempt(replay);
      setElapsedMs(0);
      return;
    }

    if (
      attempt.commands.length > attempt.runTranscriptStart &&
      !window.confirm(
        "Restart this puzzle and clear its repository state? Your timer will keep running.",
      )
    ) {
      return;
    }

    setPendingRebase(null);
    setRepository(structuredClone(puzzle.initialRepository));
    setEntries([welcomeEntry(puzzle)]);
    setActions([]);
    setAttempt(session.store.restart(attempt));
  }

  async function submitCompletion(
    completedAttempt: StoredAttempt,
    completed: CompletionRecord,
  ) {
    if (puzzle.kind !== "daily") {
      setSubmissionState("not-ranked");
      return;
    }
    if (authStatus !== "authenticated" || !user) {
      setSubmissionState("guest");
      return;
    }

    setSubmissionState("submitting");
    setSubmissionError(undefined);
    try {
      const serverAttemptId =
        completedAttempt.serverAttemptId && completedAttempt.serverUserId === user.id
          ? completedAttempt.serverAttemptId
          : await ensureServerAttempt();
      await submitDailyResult(serverAttemptId, completed);
      session.store.markCompletionRanked(completed.id);
      setSubmissionState("submitted");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Leaderboard submission failed.";
      setSubmissionError(message);
      setSubmissionState("failed");
    }
  }

  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  const accentClasses =
    accent === "violet"
      ? "text-violet-300 border-violet-400/30 bg-violet-400/10"
      : "text-emerald-300 border-emerald-400/30 bg-emerald-400/10";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
            <AppLink
              href={backHref}
              onNavigate={onNavigate}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900"
            >
              ← {backLabel}
            </AppLink>
            <div>
              <p
                className={`text-xs font-bold uppercase tracking-[0.22em] ${
                  accent === "violet" ? "text-violet-300" : "text-emerald-300"
                }`}
              >
                {eyebrow}
              </p>
              <h1 className="mt-1 text-xl font-bold">{puzzle.title}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-slate-300">
              {minutes}:{seconds}
            </span>
            <span className="rounded-lg bg-slate-900 px-3 py-2 text-slate-400">
              Restarts: {attempt.restartCount}
            </span>
            <button
              onClick={restartPuzzle}
              className="min-h-11 rounded-lg border border-slate-600 px-3 py-2 font-semibold text-slate-200 hover:border-slate-400 hover:bg-slate-900"
            >
              {validation.solved ? "Replay puzzle" : "Restart puzzle"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
        <div
          className={`mb-6 rounded-xl border p-4 ${
            validation.solved
              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
              : accentClasses
          }`}
        >
          <p className="font-semibold">
            {validation.solved ? "Solved — nice history!" : puzzle.description}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Commands: {attempt.commandCount} · HEAD: {repository.head} · Branch: {repository.currentBranch}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr_0.9fr]">
          <div className="order-2 space-y-6 xl:order-1">
            <GoalPanel objectives={puzzle.objectives ?? []} validation={validation} />
            <GitGraph repository={repository} />
          </div>

          <div className="order-1 space-y-4 sm:space-y-6 xl:order-2">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ChickenIllustration label="Current" state={currentState} />
              <ChickenIllustration label="Target" state={puzzle.target.snapshot} />
            </div>
            <Terminal
              entries={entries}
              onCommand={runCommand}
              disabled={validation.solved}
              examples={puzzle.allowedCommands.includes("log") ? ["git log", "git log --all"] : []}
            />
          </div>

          <div className="order-3">
            <GitLog repository={repository} />
          </div>
        </div>
      </main>

      {pendingRebase && (
        <InteractiveRebaseDialog
          onto={pendingRebase.onto}
          branch={repository.currentBranch}
          todo={pendingRebase.todo}
          onCancel={cancelRebase}
          onConfirm={(todo) => {
            setPendingRebase(null);
            runCommand(formatInteractiveRebaseCommand(pendingRebase.onto, todo));
          }}
        />
      )}

      {completion && showResult && (
        <ResultModal
          puzzle={puzzle}
          completion={completion}
          submissionState={submissionState}
          submissionError={submissionError}
          onClose={() => setShowResult(false)}
          onHome={() => onNavigate(backHref)}
        />
      )}
    </div>
  );
}

function restorePuzzleRun(
  puzzle: PublicPuzzleDefinition,
  attempt: StoredAttempt,
): { repository: Repository; actions: GitAction[]; entries: TerminalEntry[] } {
  let repository = structuredClone(puzzle.initialRepository);
  const actions: GitAction[] = [];

  for (const command of attempt.runCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok || !puzzle.allowedCommands.includes(parsed.action.type)) continue;
    const result = executeCommand(repository, command);
    repository = result.repository;
    if (result.ok) actions.push(result.action);
  }

  const entries: TerminalEntry[] = [
    welcomeEntry(puzzle),
    ...attempt.commands.slice(attempt.runTranscriptStart).map((entry, index) => ({
      id: index + 1,
      command: entry.command,
      lines: entry.output.split("\n"),
      tone: entry.ok ? "normal" as const : "error" as const,
    })),
  ];
  return { repository, actions, entries };
}

function welcomeEntry(puzzle: PublicPuzzleDefinition): TerminalEntry {
  return {
    id: 0,
    lines: [
      "Welcome to the GitGud simulator.",
      `Available command types: ${puzzle.allowedCommands.join(", ")}.`,
    ],
  };
}
