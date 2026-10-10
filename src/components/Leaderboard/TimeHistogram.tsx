import { formatElapsed, type LeaderboardEntry } from "../../services/leaderboard";
import { buildTimeHistogram } from "./histogramBins";

export function TimeHistogram({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const bins = buildTimeHistogram(entries.map((entry) => entry.elapsedMs));
  if (bins.length === 0) return null;

  const largestCount = Math.max(...bins.map((bin) => bin.count));
  const currentUserEntry = entries.find((entry) => entry.isCurrentUser);
  // The winner's bar is white, unless the winner is you (your bar is always green).
  const winnerEntry = entries.find((entry) => entry.rank === 1 && !entry.isCurrentUser);
  const inBin = (entry: LeaderboardEntry | undefined, bin: { startMs: number; endMs: number }) =>
    Boolean(entry && entry.elapsedMs >= bin.startMs && entry.elapsedMs < bin.endMs + 1_000);

  return (
    <section
      aria-labelledby="time-distribution-title"
      className="flex flex-col gap-1 pt-4"
    >
      <h2 id="time-distribution-title" className="text-xl leading-[25px] text-green-950">
        Solve times
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grey-700">
        <p>Ranked finishes, faster to slower.</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {winnerEntry && (
            <p className="flex items-center gap-2 text-green-950">
              <span className="size-2.5 rounded border border-grey-400 bg-grey-50" aria-hidden="true" />
              Winner: {formatElapsed(winnerEntry.elapsedMs)}
            </p>
          )}
          {currentUserEntry && (
            <p className="flex items-center gap-2 text-green-950">
              <span className="size-2.5 rounded bg-lime-500" aria-hidden="true" />
              Your solve: {formatElapsed(currentUserEntry.elapsedMs)}
            </p>
          )}
        </div>
      </div>

      <ul
        className="mt-4 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}
        aria-label={histogramSummary(entries.length, bins.length)}
      >
        {bins.map((bin) => {
          const height = largestCount === 0 || bin.count === 0
            ? 0
            : Math.max(8, (bin.count / largestCount) * 82);
          const containsCurrentUser = inBin(currentUserEntry, bin);
          const containsWinner = !containsCurrentUser && inBin(winnerEntry, bin);
          return (
            <li
              key={`${bin.startMs}-${bin.endMs}`}
              className="flex min-w-0 flex-col text-center"
              aria-label={`${bin.label}: ${bin.count} ${bin.count === 1 ? "solve" : "solves"}${containsCurrentUser ? "; includes your solve" : ""}${containsWinner ? "; includes the winner" : ""}`}
            >
              <div className="flex h-40 flex-col justify-end" aria-hidden="true">
                <span
                  className={`mb-1 font-secondary text-xs tabular-nums ${
                    containsCurrentUser ? "text-green-950" : "text-grey-700"
                  }`}
                >
                  {bin.count}
                </span>
                <div
                  className={`w-full rounded transition-[height] duration-300 motion-reduce:transition-none ${
                    containsCurrentUser
                      ? "bg-lime-500"
                      : containsWinner
                        ? "border border-grey-400 bg-grey-50"
                        : "bg-grey-500"
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <span
                className={`truncate py-2 font-secondary text-xs tabular-nums ${
                  containsCurrentUser ? "text-green-950" : "text-grey-700"
                }`}
              >
                {formatTick(bin.startMs)}
              </span>
            </li>
          );
        })}
      </ul>
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

