import type { Repository } from "../../engine";

export interface TreeNode {
  id: string;
  /** Column in leaf units; parents sit centred over their first-parent children. */
  col: number;
  /** Generation: the longest parent path back to a root commit. */
  row: number;
}

export interface TreeEdge {
  from: string;
  to: string;
  /** True for a merge commit's second (or later) parent. */
  secondary: boolean;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  columns: number;
  rows: number;
}

/**
 * Top-down tree layout used by the illustrated graph: roots at the top, each
 * first-parent subtree spread across its own columns, merges under their first parent.
 */
export function layoutCommitTree(repository: Repository): TreeLayout {
  const commits = repository.commits;
  const ids = Object.keys(commits);
  const rowOf = new Map<string, number>();
  const row = (id: string): number => {
    const known = rowOf.get(id);
    if (known !== undefined) return known;
    rowOf.set(id, 0); // Guards against malformed cycles.
    const parents = commits[id]?.parents.filter((parent) => parent in commits) ?? [];
    const value = parents.length ? 1 + Math.max(...parents.map(row)) : 0;
    rowOf.set(id, value);
    return value;
  };

  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const id of ids) {
    const first = commits[id].parents[0];
    if (first && first in commits) children.set(first, [...(children.get(first) ?? []), id]);
    else roots.push(id);
  }

  const laneOf = branchLanes(repository);
  const sameLane = (a: string, b: string) => laneOf.get(a) === undefined || laneOf.get(a) === laneOf.get(b);

  const colOf = new Map<string, number>();
  let nextLeaf = 0;
  const place = (id: string) => {
    // The child that continues this commit's branch goes first (leftmost).
    const kids = [...(children.get(id) ?? [])].sort((a, b) => Number(!sameLane(a, id)) - Number(!sameLane(b, id)));
    if (kids.length && !kids.some((kid) => sameLane(kid, id))) {
      // Every child starts a different branch: keep this commit in its own column so
      // the new branch steps sideways instead of reading as a continuation below it.
      colOf.set(id, nextLeaf++);
      kids.forEach(place);
      return;
    }
    kids.forEach(place);
    colOf.set(id, kids.length ? (colOf.get(kids[0])! + colOf.get(kids[kids.length - 1])!) / 2 : nextLeaf++);
  };
  roots.forEach(place);

  const nodes = ids.map((id) => ({ id, col: colOf.get(id) ?? 0, row: row(id) }));
  const edges = ids.flatMap((id) =>
    commits[id].parents
      .filter((parent) => parent in commits)
      .map((parent, index) => ({ from: parent, to: id, secondary: index > 0 })),
  );

  return {
    nodes,
    edges,
    columns: Math.max(1, nextLeaf),
    rows: nodes.length ? Math.max(...nodes.map((node) => node.row)) + 1 : 0,
  };
}

/**
 * Assigns each commit to the branch that "owns" it: walking first parents back from
 * each tip, main/master first so the trunk stays stable when HEAD moves.
 * Commits no branch reaches are left unassigned.
 */
export function branchLanes(repository: Repository): Map<string, string> {
  const laneOf = new Map<string, string>();
  for (const name of branchOrder(repository)) {
    let id: string | undefined = repository.branches[name];
    while (id && id in repository.commits && !laneOf.has(id)) {
      laneOf.set(id, name);
      id = repository.commits[id].parents[0];
    }
  }
  return laneOf;
}

/** Branch names with main/master first, then in the puzzle's own order. */
export function branchOrder(repository: Repository): string[] {
  const trunk = (name: string) => (name === "main" || name === "master" ? 0 : 1);
  return Object.keys(repository.branches).sort((a, b) => trunk(a) - trunk(b));
}

const BRANCH_COLOURS = 6;

/**
 * A CSS colour per branch, stable for the whole puzzle: the trunk is always
 * branch colour 1 and the rest follow the puzzle's branch order, cycling if needed.
 */
export function branchColours(repository: Repository): Map<string, string> {
  return new Map(
    branchOrder(repository).map((name, index) => [name, `rgb(var(--colors-branch-${(index % BRANCH_COLOURS) + 1}))`]),
  );
}
