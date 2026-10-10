import { describe, expect, it } from "vitest";
import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("matches the Figma result popup format", () => {
    expect(formatDuration(235_000)).toBe("3m 55s");
    expect(formatDuration(42_400)).toBe("42s");
    expect(formatDuration(60_000)).toBe("1m 0s");
    expect(formatDuration(-5)).toBe("0s");
  });
});
