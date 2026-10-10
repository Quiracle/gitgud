import { formatElapsed } from "../../services/leaderboard";

export interface TimeHistogramBin {
  startMs: number;
  endMs: number;
  count: number;
  label: string;
}

export function buildTimeHistogram(
  elapsedTimes: readonly number[],
  maximumBins = 7,
): TimeHistogramBin[] {
  const seconds = elapsedTimes
    .filter((value) => Number.isFinite(value) && value >= 0)
    .map((value) => Math.floor(value / 1_000))
    .sort((left, right) => left - right);

  if (seconds.length === 0) return [];

  const minimum = seconds[0];
  const maximum = seconds[seconds.length - 1];
  const secondRange = maximum - minimum + 1;
  const desiredBins = Math.min(
    Math.max(1, Math.floor(maximumBins)),
    secondRange,
    Math.max(1, Math.ceil(Math.sqrt(seconds.length))),
  );
  const secondsPerBin = Math.max(1, Math.ceil(secondRange / desiredBins));
  const binCount = Math.ceil(secondRange / secondsPerBin);

  const bins = Array.from({ length: binCount }, (_, index) => {
    const startSeconds = minimum + index * secondsPerBin;
    const endSeconds = Math.min(maximum, startSeconds + secondsPerBin - 1);
    return {
      startMs: startSeconds * 1_000,
      endMs: endSeconds * 1_000,
      count: 0,
      label: formatRange(startSeconds, endSeconds),
    };
  });

  for (const value of seconds) {
    const index = Math.min(Math.floor((value - minimum) / secondsPerBin), bins.length - 1);
    bins[index].count += 1;
  }

  return bins;
}

function formatRange(startSeconds: number, endSeconds: number): string {
  const start = formatElapsed(startSeconds * 1_000);
  if (startSeconds === endSeconds) return start;
  return `${start}–${formatElapsed(endSeconds * 1_000)}`;
}

