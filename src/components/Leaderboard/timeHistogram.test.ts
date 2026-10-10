import { describe, expect, it } from "vitest";
import { buildTimeHistogram, percentAxisMax } from "./histogramBins";

describe("buildTimeHistogram", () => {
  it("returns no bins when there are no valid solve times", () => {
    expect(buildTimeHistogram([])).toEqual([]);
    expect(buildTimeHistogram([-1, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([]);
  });

  it("spans from zero to the slowest solve plus a minute in many thin bins", () => {
    // Four quick solves, like the screenshot: 0:10–0:20 plus one at 0:40.
    const bins = buildTimeHistogram([10_000, 12_000, 13_000, 40_000]);

    expect(bins[0].startMs).toBe(0);
    expect(bins.at(-1)!.endMs).toBeGreaterThanOrEqual(100_000);
    expect(bins.length).toBeGreaterThanOrEqual(20);
    expect(bins[0].endMs).toBe(2_000);
    expect(bins.filter((bin) => bin.count > 0).length).toBe(3);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(4);
  });

  it("snaps the bin width to a readable step for long solves", () => {
    const bins = buildTimeHistogram([5 * 60_000, 12 * 60_000]);
    const width = bins[0].endMs - bins[0].startMs;
    expect(width).toBe(15_000);
    expect(bins.length).toBeLessThanOrEqual(60);
  });

  it("puts each solve in the bin that contains it and reports shares", () => {
    const bins = buildTimeHistogram([0, 1_999, 2_000], { targetBins: 30, paddingMs: 60_000 });
    const width = bins[0].endMs;
    const first = bins.find((bin) => bin.startMs <= 1_999 && 1_999 < bin.endMs)!;
    expect(first.count).toBe(width > 2_000 ? 3 : 2);
    expect(bins.reduce((sum, bin) => sum + bin.percent, 0)).toBeCloseTo(100);
  });

  it("rounds the percentage axis up to a clean value", () => {
    expect(percentAxisMax(buildTimeHistogram([10_000, 10_000, 10_000, 40_000]))).toBe(75);
    expect(percentAxisMax(buildTimeHistogram([1_000, 30_000, 60_000, 90_000, 120_000]))).toBe(20);
  });
});
