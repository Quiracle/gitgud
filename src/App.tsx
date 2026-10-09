import { useEffect, useMemo, useState } from "react";
import { GitGraph } from "./components/GitGraph/GitGraph";
import { GitLog } from "./components/GitLog/GitLog";
import { GoalPanel } from "./components/GoalPanel/GoalPanel";
import { ChickenIllustration } from "./components/Illustration/ChickenIllustration";
import { Terminal, type TerminalEntry } from "./components/Terminal/Terminal";
import {
  executeCommand,
  getSnapshot,
  validateRepository,
  type Repository,
} from "./engine";
import { chickenCoronationPuzzle } from "./puzzles";

function freshRepository(): Repository {
  return structuredClone(chickenCoronationPuzzle.initialRepository);
}

const welcomeEntry: TerminalEntry = {
  id: 0,
  lines: [
    "Welcome to the GitGud simulator.",
    "Try `git log`, then transform the repository to match the target.",
  ],
};

export default function App() {
  const [repository, setRepository] = useState(freshRepository);
  const [entries, setEntries] = useState<TerminalEntry[]>([welcomeEntry]);
  const [restartCount, setRestartCount] = useState(0);
  const [commandCount, setCommandCount] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const validation = useMemo(
    () => validateRepository(repository, chickenCoronationPuzzle.target),
    [repository],
  );
  const currentState = useMemo(() => getSnapshot(repository), [repository]);

  useEffect(() => {
    if (validation.solved) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, validation.solved]);

  function runCommand(command: string) {
    const result = executeCommand(repository, command);
    setCommandCount((count) => count + 1);

    const nextValidation = validateRepository(
      result.repository,
      chickenCoronationPuzzle.target,
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
        lines: ["Puzzle solved! Repository state and history both match."],
        tone: "success",
      });
    }

    setEntries(nextEntries);
    setRepository(result.repository);
  }

  function restartPuzzle() {
    const hasProgress = commandCount > 0;
    if (hasProgress && !window.confirm("Restart this puzzle and clear the current run?")) {
      return;
    }

    setRepository(freshRepository());
    setEntries([welcomeEntry]);
    setRestartCount((count) => count + 1);
    setCommandCount(0);
    setStartedAt(Date.now());
    setElapsedSeconds(0);
  }

  const minutes = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">
              GitGud engine preview
            </p>
            <h1 className="mt-1 text-xl font-bold">{chickenCoronationPuzzle.title}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-slate-300">
              {minutes}:{seconds}
            </span>
            <span className="rounded-lg bg-slate-900 px-3 py-2 text-slate-400">
              Restarts: {restartCount}
            </span>
            <button
              onClick={restartPuzzle}
              className="rounded-lg border border-slate-600 px-3 py-2 font-semibold text-slate-200 hover:border-slate-400 hover:bg-slate-900"
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
              ? "border-emerald-400/60 bg-emerald-400/10"
              : "border-indigo-400/30 bg-indigo-400/10"
          }`}
        >
          <p className="font-semibold">
            {validation.solved ? "Solved — nice history!" : chickenCoronationPuzzle.description}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Commands: {commandCount} · HEAD: {repository.head} · Branch:{" "}
            {repository.currentBranch}
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr_0.9fr]">
          <div className="order-2 space-y-6 xl:order-1">
            <GoalPanel
              objectives={chickenCoronationPuzzle.objectives}
              validation={validation}
            />
            <GitGraph repository={repository} />
          </div>

          <div className="order-1 space-y-4 sm:space-y-6 xl:order-2">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <ChickenIllustration label="Current" state={currentState} />
              <ChickenIllustration
                label="Target"
                state={chickenCoronationPuzzle.targetState}
              />
            </div>
            <Terminal
              entries={entries}
              onCommand={runCommand}
              disabled={validation.solved}
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
