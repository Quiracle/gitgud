import { describe, expect, it } from "vitest";
import type { PuzzleTarget, Repository } from "../../engine";
import { fingerprintMechanics } from "./novelty";

function fixture(): { repository: Repository; target: PuzzleTarget } {
  return {
    repository: {
      commits: {
        root: { id: "root", parents: [], message: "ignored", changes: [] },
        main: { id: "main", parents: ["root"], message: "ignored", changes: [{ type: "set", property: "coat", from: "cream", to: "blue" }] },
        side: { id: "side", parents: ["root"], message: "ignored", changes: [{ type: "set", property: "hat", from: "none", to: "red" }, { type: "set", property: "scarf", from: "none", to: "gold" }] },
      },
      branches: { main: "main", feature: "side" }, currentBranch: "main", head: "main",
      initialState: { coat: "cream", hat: "none", scarf: "none" }, nextGeneratedId: 1,
    },
    target: { branch: "main", snapshot: { coat: "blue", hat: "none", scarf: "none" } },
  };
}
const fp = (r: Repository, t: PuzzleTarget) => fingerprintMechanics(r, t).canonical;

describe("procedural mechanics fingerprint", () => {
  it("ignores commit IDs, side branch names, prose, property labels, and consistently renamed values", () => {
    const a = fixture();
    const b: Repository = {
      commits: {
        z: { id: "z", parents: [], message: "other prose", changes: [] },
        x: { id: "x", parents: ["z"], message: "other prose", changes: [{ type: "set", property: "body", from: "ivory", to: "navy" }] },
        y: { id: "y", parents: ["z"], message: "other prose", changes: [{ type: "set", property: "glasses", from: "absent", to: "green" }, { type: "set", property: "legs", from: "absent", to: "amber" }] },
      },
      branches: { main: "x", renamedSideBranch: "y" }, currentBranch: "main", head: "x",
      initialState: { legs: "absent", body: "ivory", glasses: "absent" }, nextGeneratedId: 777,
    };
    const target = { branch: "main", snapshot: { legs: "absent", body: "navy", glasses: "absent" } };
    expect(fp(a.repository, a.target)).toBe(fp(b, target));
  });

  it("ignores object key insertion order", () => {
    const a = fixture();
    const b = structuredClone(a);
    b.repository.initialState = { scarf: "none", coat: "cream", hat: "none" };
    b.target.snapshot = { scarf: "none", coat: "blue", hat: "none" };
    expect(fp(a.repository, a.target)).toBe(fp(b.repository, b.target));
  });

  it("distinguishes changed dependencies, forks, bundles, and target branch relations", () => {
    const base = fixture();
    const dependent = structuredClone(base);
    dependent.repository.commits.side.parents = ["main"];
    expect(fp(base.repository, base.target)).not.toBe(fp(dependent.repository, dependent.target));

    const noFork = structuredClone(base);
    noFork.repository.commits.side.parents = ["main"];
    expect(fp(base.repository, base.target)).not.toBe(fp(noFork.repository, noFork.target));

    const splitBundle = structuredClone(base);
    delete splitBundle.repository.commits.side;
    splitBundle.repository.commits.sideHat = { id: "sideHat", parents: ["root"], message: "", changes: [{ type: "set", property: "hat", from: "none", to: "red" }] };
    splitBundle.repository.commits.sideScarf = { id: "sideScarf", parents: ["sideHat"], message: "", changes: [{ type: "set", property: "scarf", from: "none", to: "gold" }] };
    splitBundle.repository.branches.feature = "sideScarf";
    expect(fp(base.repository, base.target)).not.toBe(fp(splitBundle.repository, splitBundle.target));

    const otherTarget = structuredClone(base);
    otherTarget.target.branch = "feature";
    expect(fp(base.repository, base.target)).not.toBe(fp(otherTarget.repository, otherTarget.target));
  });
});
