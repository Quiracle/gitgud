import { describe, expect, it } from "vitest";
import { chickenCoronationPuzzle } from "./chickenCoronation";
import { routeThroughFirstWin } from "./solutionRoute";

describe("routeThroughFirstWin", () => {
  const win = ["git revert b22", "git cherry-pick s14"];

  it("stops at the first winning command", () => {
    expect(routeThroughFirstWin(chickenCoronationPuzzle, [...win, "git revert s14"])).toEqual(win);
  });

  it("rejects routes that fail or never win", () => {
    expect(routeThroughFirstWin(chickenCoronationPuzzle, ["git revert b22"])).toBeUndefined();
    expect(routeThroughFirstWin(chickenCoronationPuzzle, ["git switch nowhere"])).toBeUndefined();
  });
});
