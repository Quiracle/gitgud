import { formatElapsed, type LeaderboardEntry } from "../../services/leaderboard";
import { buildTimeHistogram } from "./histogramBins";

export function TimeHistogram({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const bins = buildTimeHistogram(entries.map((entry) => entry.elapsedMs));
  if (bins.length === 0) return null;

  const largestCount = Math.max(...bins.map((bin) => bin.count));
  const currentUserEntry = entries.find((entry) => entry.isCurrentUser);

  return (
    <section
      aria-labelledby="time-distribution-title"
      className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
    >
      <h2 id="time-distribution-title" className="text-xl font-black text-white">
        Solve-time distribution
      </h2>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <p>Ranked finishes distributed from faster to slower.</p>
        {currentUserEntry && (
          <p className="flex items-center gap-2 text-lime-300">
            <span className="h-2.5 w-2.5 bg-lime-300" aria-hidden="true" />
            Your solve: {formatElapsed(currentUserEntry.elapsedMs)}
          </p>
        )}
      </div>

      <ul
        className="mt-6 grid gap-1 border-b border-slate-700"
        style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}
        aria-label={histogramSummary(entries.length, bins.length)}
      >
        {bins.map((bin) => {
          const height = largestCount === 0 || bin.count === 0
            ? 0
            : Math.max(8, (bin.count / largestCount) * 82);
          const containsCurrentUser = Boolean(
            currentUserEntry &&
            currentUserEntry.elapsedMs >= bin.startMs &&
            currentUserEntry.elapsedMs < bin.endMs + 1_000,
          );
          return (
            <li
              key={`${bin.startMs}-${bin.endMs}`}
              className="flex min-w-0 flex-col text-center"
              aria-label={`${bin.label}: ${bin.count} ${bin.count === 1 ? "solve" : "solves"}${containsCurrentUser ? "; includes your solve" : ""}`}
            >
              <div className="flex h-40 flex-col justify-end" aria-hidden="true">
                <span
                  className={`mb-1 font-mono text-xs font-bold tabular-nums ${
                    containsCurrentUser ? "text-lime-300" : "text-slate-300"
                  }`}
                >
                  {bin.count}
                </span>
                <div
                  className={`w-full transition-[height] duration-300 motion-reduce:transition-none ${
                    containsCurrentUser ? "bg-lime-300" : "bg-cyan-300"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span
                className={`truncate py-2 font-mono text-xs tabular-nums ${
                  containsCurrentUser ? "font-bold text-lime-300" : "text-slate-400"
                }`}
              >
                {formatTick(bin.startMs)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
        Solve time
      </p>
    </section>
  );
}

function formatTick(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${(totalSeconds % 60).toString().padStart(2, "0")}`;
}

function histogramSummary(solveCount: number, binCount: number): string {
  return `Distribution of ${solveCount} ranked ${solveCount === 1 ? "solve" : "solves"} across ${binCount} time ${binCount === 1 ? "range" : "ranges"}.`;
}

