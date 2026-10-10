import { formatElapsed } from "../../services/leaderboard";

export interface TimeHistogramBin {
  startMs: number;
  /** Exclusive end of the bin. */
  endMs: number;
  count: number;
  /** Share of all solves, 0–100. */
  percent: number;
  label: string;
}

export interface TimeHistogramOptions {
  /** Roughly how many bars to draw; the width snaps to a readable step. */
  targetBins?: number;
  /** Empty room after the slowest solve so the chart never ends on its last bar. */
  paddingMs?: number;
}

/** Readable bin widths, in seconds. */
const STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1_800, 3_600];
const MAX_BINS = 60;

/**
 * LeetCode-style distribution: the axis runs from 0 to the slowest solve plus padding,
 * split into many thin bins of a readable width, so a handful of solves still spread out.
 */
export function buildTimeHistogram(
  elapsedTimes: readonly number[],
  { targetBins = 40, paddingMs = 60_000 }: TimeHistogramOptions = {},
): TimeHistogramBin[] {
  const times = elapsedTimes.filter((value) => Number.isFinite(value) && value >= 0);
  if (times.length === 0) return [];

  const rangeSeconds = Math.ceil((Math.max(...times) + paddingMs) / 1_000);
  const ideal = rangeSeconds / Math.max(1, targetBins);
  // The finest readable step near the target, without drawing more than MAX_BINS bars.
  const stepSeconds =
    STEPS.find((step, index) => (STEPS[index + 1] ?? Infinity) > ideal && rangeSeconds / step <= MAX_BINS) ??
    STEPS.find((step) => rangeSeconds / step <= MAX_BINS) ??
    Math.ceil(rangeSeconds / MAX_BINS / 3_600) * 3_600;
  const stepMs = stepSeconds * 1_000;
  const binCount = Math.max(1, Math.ceil(rangeSeconds / stepSeconds));

  const counts = new Array<number>(binCount).fill(0);
  for (const value of times) counts[Math.min(Math.floor(value / stepMs), binCount - 1)] += 1;

  return counts.map((count, index) => {
    const startMs = index * stepMs;
    const endMs = startMs + stepMs;
    return {
      startMs,
      endMs,
      count,
      percent: (count / times.length) * 100,
      label: `${formatElapsed(startMs)}–${formatElapsed(endMs)}`,
    };
  });
}

/** A round top for the percentage axis: 10, 20, 25, 50, 75 or 100. */
export function percentAxisMax(bins: readonly TimeHistogramBin[]): number {
  const largest = Math.max(0, ...bins.map((bin) => bin.percent));
  return [10, 20, 25, 50, 75, 100].find((step) => step >= largest) ?? 100;
}
