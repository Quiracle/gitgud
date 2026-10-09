import { useEffect, useMemo, useState } from "react";
import { AppLink } from "../components/AppLink";
import { GitGraph } from "../components/GitGraph/GitGraph";
import { GitLog } from "../components/GitLog/GitLog";
import { GoalPanel } from "../components/GoalPanel/GoalPanel";
import { ChickenIllustration } from "../components/Illustration/ChickenIllustration";
import { Terminal, type TerminalEntry } from "../components/Terminal/Terminal";
import {
  executeCommand,
  getSnapshot,
  parseGitCommand,
  type GitAction,
  type Repository,
} from "../engine";
import {
  validatePuzzleCompletion,
  type PublicPuzzleDefinition,
} from "../puzzles";

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
  const [repository, setRepository] = useState<Repository>(() =>
    structuredClone(puzzle.initialRepository),
  );
  const [entries, setEntries] = useState<TerminalEntry[]>(() => [welcomeEntry(puzzle)]);
  const [actions, setActions] = useState<GitAction[]>([]);
  const [restartCount, setRestartCount] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

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
    const update = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, validation.solved]);

  function runCommand(command: string) {
    const parsed = parseGitCommand(command);
    const commandAllowed = !parsed.ok || puzzle.allowedCommands.includes(parsed.action.type);
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

    if (!validation.solved && nextValidation.solved) {
      nextEntries.push({
        id: entries.length + 1,
        lines: ["Puzzle solved! Repository state, history, and lesson goals match."],
        tone: "success",
      });
    }

    setCommandCount((count) => count + 1);
    setEntries(nextEntries);
    setActions(nextActions);
    setRepository(result.repository);
  }

  function restartPuzzle() {
    if (
      commandCount > 0 &&
      !window.confirm(
        "Restart this puzzle and clear its repository state? Your timer will keep running.",
      )
    ) {
      return;
    }

    setRepository(structuredClone(puzzle.initialRepository));
    setEntries([welcomeEntry(puzzle)]);
    setActions([]);
    setRestartCount((count) => count + 1);
    setCommandCount(0);
  }

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
              Restarts: {restartCount}
            </span>
            <button
              onClick={restartPuzzle}
              className="min-h-11 rounded-lg border border-slate-600 px-3 py-2 font-semibold text-slate-200 hover:border-slate-400 hover:bg-slate-900"
            >
              Restart puzzle
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
            Commands: {commandCount} · HEAD: {repository.head} · Branch: {repository.currentBranch}
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
    </div>
  );
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
