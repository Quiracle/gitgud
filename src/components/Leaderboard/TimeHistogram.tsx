import { useI18n, type I18nValue } from "../../i18n/I18nProvider";
import { formatElapsed, type LeaderboardEntry } from "../../services/leaderboard";
import { buildTimeHistogram, percentAxisMax } from "./histogramBins";

const TICKS = 5;

/** LeetCode-style solve-time distribution: thin bars from 0 to past the slowest solve. */
export function TimeHistogram({ entries }: { entries: readonly LeaderboardEntry[] }) {
  const i18n = useI18n();
  const { t } = i18n;
  const bins = buildTimeHistogram(entries.map((entry) => entry.elapsedMs));
  if (bins.length === 0) return null;

  const axisMax = percentAxisMax(bins);
  const currentUserEntry = entries.find((entry) => entry.isCurrentUser);
  const currentBin = currentUserEntry
    ? bins.findIndex((bin) => currentUserEntry.elapsedMs >= bin.startMs && currentUserEntry.elapsedMs < bin.endMs)
    : -1;
  const tickEvery = Math.max(1, Math.ceil(bins.length / TICKS));

  return (
    <section aria-labelledby="time-distribution-title" className="flex flex-col gap-1 pt-4">
      <h2 id="time-distribution-title" className="text-xl leading-[25px] text-green-950">
        {t("histogram.title")}
      </h2>
      {currentUserEntry && (
        <p className="flex items-center gap-2 text-xs text-green-950">
          <span className="size-2.5 rounded bg-lime-500" aria-hidden="true" />
          {t("histogram.yourSolve", { time: formatElapsed(currentUserEntry.elapsedMs) })}
        </p>
      )}

      <div className="mt-4 flex gap-2" aria-label={histogramSummary(entries.length, bins, t)} role="img">
        {/* Percentage axis */}
        <div className="flex h-40 flex-col justify-between py-0 font-secondary text-2xs tabular-nums text-grey-700" aria-hidden="true">
          <span className="-translate-y-1/2">{axisMax}%</span>
          <span>{axisMax / 2}%</span>
          <span className="translate-y-1/2">0%</span>
        </div>

        <div className="min-w-0 flex-1" aria-hidden="true">
          <div className="relative h-40">
            {/* Gridlines at the top, middle, and baseline */}
            {[0, 50, 100].map((offset) => (
              <div key={offset} className="absolute inset-x-0 border-t border-grey-300" style={{ top: `${offset}%` }} />
            ))}
            <div className="absolute inset-0 flex items-end gap-px sm:gap-0.5">
              {bins.map((bin, index) => {
                const mine = index === currentBin;
                const height = bin.count === 0 ? 0 : Math.max(3, (bin.percent / axisMax) * 100);
                return (
                  <div
                    key={bin.startMs}
                    className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
                    title={t("histogram.barTitle", { range: bin.label, solves: t("histogram.solves", { count: bin.count }), percent: Math.round(bin.percent) })}
                  >
                    {mine && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-lime-500 px-1 font-secondary text-2xs leading-4 text-green-950"
                        style={{ bottom: `calc(${height}% + 4px)` }}
                      >
                        {t("leaderboard.you")}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-full transition-[height] duration-300 motion-reduce:transition-none ${
                        mine ? "bg-lime-500" : "bg-grey-500"
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time axis */}
          <div className="relative mt-2 h-4 font-secondary text-2xs tabular-nums text-grey-700">
            {bins.map((bin, index) =>
              index % tickEvery === 0 ? (
                <span
                  key={bin.startMs}
                  className="absolute -translate-x-1/2 first:translate-x-0"
                  style={{ left: `${(index / bins.length) * 100}%` }}
                >
                  {formatTick(bin.startMs, t)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatTick(elapsedMs: number, t: I18nValue["t"]): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  if (totalSeconds < 60) return t("histogram.tickSeconds", { seconds: totalSeconds });
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0
    ? t("histogram.tickMinutes", { minutes })
    : `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function histogramSummary(solveCount: number, bins: ReturnType<typeof buildTimeHistogram>, t: I18nValue["t"]): string {
  const busiest = bins.reduce((best, bin) => (bin.count > best.count ? bin : best), bins[0]);
  return t("histogram.summary", {
    solves: t("histogram.rankedSolves", { count: solveCount }),
    end: formatElapsed(bins.at(-1)!.endMs),
    busiest: busiest.label,
  });
}
