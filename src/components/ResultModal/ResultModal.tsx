import { useEffect, useState } from "react";
import type { PublicPuzzleDefinition } from "../../puzzles";
import {
  formatElapsed,
  getDailyLeaderboard,
  type LeaderboardEntry,
} from "../../services/leaderboard";
import type { CompletionRecord } from "../../storage/progress";
import { LeaderboardTable } from "../Leaderboard/LeaderboardTable";

export type SubmissionState = "guest" | "not-ranked" | "submitting" | "submitted" | "failed";

interface ResultModalProps {
  puzzle: PublicPuzzleDefinition;
  completion: CompletionRecord;
  submissionState: SubmissionState;
  submissionError?: string;
  onClose: () => void;
  onHome: () => void;
}

export function ResultModal({
  puzzle,
  completion,
  submissionState,
  submissionError,
  onClose,
  onHome,
}: ResultModalProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardError, setLeaderboardError] = useState<string>();

  useEffect(() => {
    if (puzzle.kind !== "daily") return;
    void getDailyLeaderboard(puzzle.id, puzzle.version)
      .then(setEntries)
      .catch((reason) => {
        setLeaderboardError(reason instanceof Error ? reason.message : "Leaderboard unavailable.");
      });
  }, [puzzle, submissionState]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="mx-auto my-4 w-full max-w-3xl rounded-3xl border border-emerald-400/30 bg-slate-900 p-5 shadow-2xl sm:my-10 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Puzzle solved</p>
        <h2 className="mt-3 text-3xl font-black text-white">Nice history!</h2>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Metric label="Time" value={formatElapsed(completion.elapsedMs)} />
          <Metric label="Restarts" value={completion.restartCount.toString()} />
          <Metric label="Commands" value={completion.commandCount.toString()} />
        </div>

        <p className="mt-4 text-sm text-slate-400">
          {submissionMessage(submissionState, submissionError)}
        </p>

        {puzzle.kind === "daily" && (
          <section className="mt-7 rounded-2xl border border-slate-700 bg-slate-950/60 p-3 sm:p-5">
            <h3 className="px-2 text-lg font-bold text-white">Daily leaderboard</h3>
            {leaderboardError ? (
              <p className="px-2 py-6 text-sm text-rose-200">{leaderboardError}</p>
            ) : (
              <LeaderboardTable entries={entries} />
            )}
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-slate-600 px-5 py-3 font-bold text-slate-200"
          >
            Review puzzle
          </button>
          <button
            type="button"
            onClick={onHome}
            className="min-h-11 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-emerald-950"
          >
            Return home
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950 p-4 text-center">
      <p className="font-mono text-xl font-black text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function submissionMessage(state: SubmissionState, error?: string): string {
  switch (state) {
    case "guest":
      return "Saved on this device. Sign in before starting a future daily attempt to rank it.";
    case "not-ranked":
      return "Lesson progress was saved on this device.";
    case "submitting":
      return "Submitting your authenticated daily result…";
    case "submitted":
      return "Your best authenticated result is on the daily leaderboard.";
    case "failed":
      return error ?? "Your result was saved locally, but leaderboard submission failed.";
  }
}
