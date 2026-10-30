import { describe, expect, it } from "vitest";
import type { Repository } from "../../engine";
import { branchColours, branchLanes, layoutCommitTree } from "./treeLayout";

function repo(commits: Record<string, string[]>, branches: Record<string, string> = {}): Repository {
  return {
    commits: Object.fromEntries(
      Object.entries(commits).map(([id, parents]) => [id, { id, parents, message: id, changes: [] }]),
    ),
    branches,
    currentBranch: "main",
    head: Object.keys(commits).at(-1)!,
    initialState: {},
    nextGeneratedId: 1,
  };
}

describe("layoutCommitTree", () => {
  it("centres a root over two branches", () => {
    const layout = layoutCommitTree(repo({ b00: [], c01: ["b00"], s01: ["b00"] }));
    expect(layout.nodes).toEqual([
      { id: "b00", col: 0.5, row: 0 },
      { id: "c01", col: 0, row: 1 },
      { id: "s01", col: 1, row: 1 },
    ]);
    expect(layout).toMatchObject({ columns: 2, rows: 2 });
  });

  it("keeps a linear history in one column", () => {
    const layout = layoutCommitTree(repo({ a: [], b: ["a"], c: ["b"] }));
    expect(layout.nodes.map((node) => node.col)).toEqual([0, 0, 0]);
    expect(layout.rows).toBe(3);
  });

  it("steps a branch that starts at another branch's tip to the side", () => {
    const layout = layoutCommitTree(repo({ a10: [], s20: ["a10"] }, { main: "a10", style: "s20" }));
    expect(layout.nodes).toEqual([
      { id: "a10", col: 0, row: 0 },
      { id: "s20", col: 1, row: 1 },
    ]);
    expect(layout.columns).toBe(2);
  });

  it("keeps a branch's own history in one column", () => {
    const layout = layoutCommitTree(repo({ a: [], b: ["a"], c: ["b"] }, { main: "c" }));
    expect(layout.nodes.map((node) => node.col)).toEqual([0, 0, 0]);
  });

  it("puts the continuing branch on the left of a fork", () => {
    const layout = layoutCommitTree(repo({ a: [], s: ["a"], b: ["a"] }, { main: "b", style: "s" }));
    expect(layout.nodes.find((node) => node.id === "b")!.col).toBeLessThan(
      layout.nodes.find((node) => node.id === "s")!.col,
    );
  });

  it("places a merge below both parents and marks the second-parent edge", () => {
    const layout = layoutCommitTree(repo({ a: [], b: ["a"], c: ["a"], m: ["b", "c"] }));
    expect(layout.nodes.find((node) => node.id === "m")).toEqual({ id: "m", col: 0, row: 2 });
    expect(layout.edges).toContainEqual({ from: "c", to: "m", secondary: true, blocked: false });
  });

  it("flags a merged-in line with a later commit below it in the same column", () => {
    const layout = layoutCommitTree(
      repo(
        { a: [], b: ["a"], c: ["b"], d: ["c"], f1: ["a"], f2: ["f1"], m: ["d", "f1"] },
        { main: "m", feature: "f2" },
      ),
    );
    expect(layout.edges).toContainEqual({ from: "f1", to: "m", secondary: true, blocked: true });
    expect(layout.edges).toContainEqual({ from: "d", to: "m", secondary: false, blocked: false });
  });

  it("leaves a merged-in line clear when only a neighbour shares its row", () => {
    const layout = layoutCommitTree(
      repo(
        { a: [], b: ["a"], p: ["a"], f: ["a"], m: ["b", "f"] },
        { main: "m", polish: "p", feature: "f" },
      ),
    );
    const col = (id: string) => layout.nodes.find((node) => node.id === id)!.col;
    expect(col("p")).toBeGreaterThan(col("m"));
    expect(col("p")).toBeLessThan(col("f"));
    expect(layout.edges).toContainEqual({ from: "f", to: "m", secondary: true, blocked: false });
  });

  it("gives main the trunk colour and colours each commit by its owning branch", () => {
    const repository = repo({ b00: [], c01: ["b00"], s01: ["b00"] }, { feature: "s01", main: "c01" });
    const colours = branchColours(repository);
    expect(colours.get("main")).toBe("rgb(var(--colors-branch-1))");
    expect(colours.get("feature")).toBe("rgb(var(--colors-branch-2))");
    const lanes = branchLanes(repository);
    expect([lanes.get("b00"), lanes.get("c01"), lanes.get("s01")]).toEqual(["main", "main", "feature"]);
  });
});
