import type { LeaderboardEntry } from "../../services/leaderboard";
import { buildTimeHistogram } from "./histogramBins";

export function TimeHistogram({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const bins = buildTimeHistogram(entries.map((entry) => entry.elapsedMs));
  if (bins.length === 0) return null;

  const largestCount = Math.max(...bins.map((bin) => bin.count));

  return (
    <section
      aria-labelledby="time-distribution-title"
      className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6"
    >
      <h2 id="time-distribution-title" className="text-xl font-black text-white">
        Solve-time distribution
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Number of ranked players finishing in each time range.
      </p>

      <ul className="mt-6 space-y-3" aria-label={histogramSummary(entries.length, bins.length)}>
        {bins.map((bin) => {
          const width = largestCount === 0 ? 0 : (bin.count / largestCount) * 100;
          return (
            <li
              key={`${bin.startMs}-${bin.endMs}`}
              className="grid grid-cols-[6.75rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"
              aria-label={`${bin.label}: ${bin.count} ${bin.count === 1 ? "solve" : "solves"}`}
            >
              <span className="font-mono text-xs tabular-nums text-slate-300">{bin.label}</span>
              <div className="h-7 overflow-hidden bg-slate-950" aria-hidden="true">
                <div
                  className="h-full bg-cyan-300 transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-right font-mono font-bold tabular-nums text-slate-100">
                {bin.count}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function histogramSummary(solveCount: number, binCount: number): string {
  return `Distribution of ${solveCount} ranked ${solveCount === 1 ? "solve" : "solves"} across ${binCount} time ${binCount === 1 ? "range" : "ranges"}.`;
}

