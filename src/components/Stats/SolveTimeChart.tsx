import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { formatDuration } from "../../lib/format";
import { spring } from "../../lib/motion";
import { chartSquares, chartStep, type DailyTime } from "../../lib/progressInsights";

const ROWS = 10;
/** Target square size and gap in px; the chart shows as many days as fit at this size. */
const SQUARE = 20;
const GAP = 4;

interface SolveTimeChartProps {
  /** Oldest first; the last entry is today. Only the most recent days that fit are shown. */
  days: DailyTime[];
}

/** Figma stats graph (node 90:161830): one column per day, squares stacked by daily solve time. */
export function SolveTimeChart({ days }: SolveTimeChartProps) {
  const { t, formatDate } = useI18n();
  const listRef = useRef<HTMLOListElement>(null);
  const [columns, setColumns] = useState(10);

  // Fit whole squares to the panel's width, keeping today as the rightmost column.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setColumns(Math.max(1, Math.floor((list.clientWidth + GAP) / (SQUARE + GAP))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  const shown = days.slice(-columns);
  const times = shown.flatMap((day) => (day.elapsedMs === undefined ? [] : [day.elapsedMs]));
  const step = chartStep(times, ROWS);
  const stepLabel =
    step < 60_000 ? t("stats.squareSeconds", { seconds: step / 1000 }) : t("stats.squareMinutes", { minutes: step / 60_000 });

  return (
    <figure className="flex flex-col gap-2">
      <div className="rounded bg-grey-300 p-4">
        <ol
          ref={listRef}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}
          aria-label={t("stats.chartLabel", { count: shown.length })}
        >
          {shown.map((day, column) => {
            const filled = day.elapsedMs === undefined ? 0 : chartSquares(day.elapsedMs, step, ROWS);
            const noon = `${day.date}T12:00:00Z`;
            const date = formatDate(noon, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
            return (
              <li key={day.date} className="flex min-w-0 flex-col gap-1">
                <span className="sr-only">
                  {day.elapsedMs === undefined
                    ? t("stats.dayUnsolved", { date })
                    : t("stats.daySolved", { date, time: formatDuration(day.elapsedMs) })}
                </span>
                {/* Bottom-up, so the stack grows from the baseline. */}
                <div className="flex flex-col-reverse gap-1" aria-hidden>
                  {Array.from({ length: ROWS }, (_, row) => (
                    <div key={row} className="relative aspect-square rounded border border-grey-400">
                      {row < filled && (
                        <motion.div
                          className="absolute -inset-px rounded bg-grey-900"
                          initial={{ scale: 0, opacity: 0 }}
                          whileInView={{ scale: 1, opacity: 1 }}
                          viewport={{ once: true }}
                          transition={{ ...spring.bouncy, delay: 0.1 + column * 0.05 + row * 0.04 }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <span className="mt-1 truncate text-center text-2xs leading-none text-green-900" aria-hidden>
                  {formatDate(noon, { weekday: "narrow", timeZone: "UTC" })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <figcaption className="flex items-baseline justify-between gap-3 text-xs leading-[15px] text-grey-700">
        <span>{times.length ? t("stats.chartCaption") : t("stats.chartEmpty")}</span>
        {times.length > 0 && <span className="shrink-0">{stepLabel}</span>}
      </figcaption>
    </figure>
  );
}
