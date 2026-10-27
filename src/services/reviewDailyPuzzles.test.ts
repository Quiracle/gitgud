import { describe, expect, it, vi } from "vitest";
import { ReviewDailyPuzzleSource } from "./reviewDailyPuzzles";
import { createDailyFixture } from "../puzzles/dailyFixture";

describe("local daily review source", () => {
  it("loads only public review data and isolates each template's progress identity", async () => {
    const fixture = createDailyFixture("2099-01-01");
    const request = vi.fn(async () => Response.json(fixture));
    const puzzle = await new ReviewDailyPuzzleSource("medium-5", request).getByDate("2026-10-27");
    expect(request).toHaveBeenCalledWith("/daily-review.local/medium-5.json");
    expect(puzzle.id).toBe("review-medium-5");
    expect(puzzle.initialRepository).toEqual(fixture.initialRepository);
    expect(puzzle.target).toEqual(fixture.target);
  });
  it("rejects paths outside the review pack and private proof files", () => {
    expect(() => new ReviewDailyPuzzleSource("../private-proofs")).toThrow();
    expect(() => new ReviewDailyPuzzleSource("private-proofs")).toThrow();
  });
  it("rejects missing files and definitions carrying private proof commands", async () => {
    const missing = vi.fn(async () => new Response("missing", { status: 404 }));
    await expect(new ReviewDailyPuzzleSource("easy-0", missing).getByDate("2026-10-27")).rejects.toThrow();
    const privateDefinition = vi.fn(async () => Response.json({ ...createDailyFixture("2099-01-01"), solutionCommands: ["git merge feature"] }));
    await expect(new ReviewDailyPuzzleSource("easy-0", privateDefinition).getByDate("2026-10-27")).rejects.toThrow();
  });
});
