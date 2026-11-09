import { describe, expect, it } from "vitest";
import type { Repository } from "../../engine";
import { chickenFeatureGoals } from "./goalFeatures";

const repository: Repository = {
  commits: {
    a10: { id: "a10", parents: [], message: "Draw the chicken", changes: [{ type: "set", property: "body", from: "none", to: "blue" }] },
    b20: { id: "b20", parents: ["a10"], message: "Add a hat", changes: [{ type: "set", property: "hat", from: "none", to: "turquoise" }] },
    c30: { id: "c30", parents: ["a10"], message: "Add shades", changes: [{ type: "set", property: "sunglasses", from: "none", to: "red" }] },
  },
  branches: { main: "a10", hats: "b20", shades: "c30" },
  currentBranch: "main",
  head: "a10",
  initialState: { body: "none" },
  nextGeneratedId: 1,
};

describe("chickenFeatureGoals", () => {
  it("lists every targeted or touched feature and ticks the ones main already shows", () => {
    const goals = chickenFeatureGoals(repository, { body: "blue", hat: "turquoise", sunglasses: "none" }, repository, "main");
    expect(goals).toEqual([
      { feature: "body", target: "blue", met: true },
      { feature: "hat", target: "turquoise", met: false },
      { feature: "sunglasses", target: "none", met: true },
    ]);
  });

  it("follows the branch tip as the player changes it", () => {
    const moved = { ...repository, branches: { ...repository.branches, main: "c30" } };
    const goals = chickenFeatureGoals(repository, { body: "blue", hat: "turquoise", sunglasses: "none" }, moved, "main");
    expect(goals.find((goal) => goal.feature === "sunglasses")?.met).toBe(false);
  });
});
