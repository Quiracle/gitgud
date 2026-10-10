import { describe, expect, it } from "vitest";
import { buildTimeHistogram } from "./histogramBins";

describe("buildTimeHistogram", () => {
  it("returns no bins when there are no valid solve times", () => {
    expect(buildTimeHistogram([])).toEqual([]);
    expect(buildTimeHistogram([-1, Number.NaN, Number.POSITIVE_INFINITY])).toEqual([]);
  });

  it("groups solve times into inclusive second ranges", () => {
    expect(buildTimeHistogram(
      [10_100, 10_900, 12_000, 20_000, 10_000, 10_000, 10_000, 10_000, 10_000],
      3,
    )).toEqual([
      { startMs: 10_000, endMs: 13_000, count: 8, label: "00:10–00:13" },
      { startMs: 14_000, endMs: 17_000, count: 0, label: "00:14–00:17" },
      { startMs: 18_000, endMs: 20_000, count: 1, label: "00:18–00:20" },
    ]);
  });

  it("uses one readable bin when all solves share the same second", () => {
    expect(buildTimeHistogram([12_010, 12_999])).toEqual([
      { startMs: 12_000, endMs: 12_000, count: 2, label: "00:12" },
    ]);
  });
});

