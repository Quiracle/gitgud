import { describe, expect, it } from "vitest";
import { formatPuzzleDate, linkedInShareUrl, shareFileName, shareText } from "./share";

const summary = { publishedOn: "2026-10-10", difficulty: "medium", elapsedMs: 167_000, restartCount: 1, assisted: false } as const;

describe("share text", () => {
  it("formats the UTC puzzle date without shifting the day", () => {
    expect(formatPuzzleDate("2026-10-10")).toBe("10 Oct 2026");
    expect(formatPuzzleDate("2027-01-01")).toBe("1 Jan 2027");
  });

  it("gives date, difficulty, time, and retries without spoilers", () => {
    expect(shareText(summary, "https://gitgudgame.lol")).toBe(
      "GitGud daily · 10 Oct 2026\nMedium puzzle, solved in 2m 47s with 1 retry.\nPlay today's puzzle: https://gitgudgame.lol",
    );
    expect(shareText({ ...summary, restartCount: 0 }, "x")).toContain("with 0 retries");
  });

  it("claims no time for an assisted run", () => {
    const text = shareText({ ...summary, assisted: true }, "x");
    expect(text).toContain("solved with help");
    expect(text).not.toContain("2m 47s");
  });

  it("builds the LinkedIn link and file name", () => {
    expect(linkedInShareUrl("https://gitgudgame.lol/")).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgitgudgame.lol%2F",
    );
    expect(shareFileName("2026-10-10")).toBe("gitgud-2026-10-10.png");
  });
});
