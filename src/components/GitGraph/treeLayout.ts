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

  const colOf = new Map<string, number>();
  let nextLeaf = 0;
  const place = (id: string) => {
    const kids = children.get(id) ?? [];
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
