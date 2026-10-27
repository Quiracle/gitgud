import type { PuzzleTarget, Repository, SemanticState } from "../../engine";

/**
 * Conservative, ID and prose independent mechanics fingerprint for daily diversity.
 * This is color refinement over a directed, edge-labelled relational graph (WL-1),
 * not a complete graph-isomorphism canonicalizer. Symmetric graphs can collide;
 * callers should treat a match as a reason to reject a candidate for novelty only.
 */
export interface MechanicsFingerprint {
  canonical: string;
  summary: { commits: number; branches: number; properties: number; changes: number; parents: number; bundles: number };
}

type Edge = { label: string; to: number };
type Node = { color: string; edges: Edge[] };

export function fingerprintMechanics(repository: Repository, target: PuzzleTarget): MechanicsFingerprint {
  const nodes: Node[] = [];
  const add = (color: string) => (nodes.push({ color, edges: [] }), nodes.length - 1);
  const link = (from: number, label: string, to: number) => nodes[from].edges.push({ label, to });
  const commitIds = Object.keys(repository.commits);
  const commits = new Map<string, number>();
  for (const id of commitIds) commits.set(id, add("commit"));
  const stateNodes = new Map<string, number>();
  const branchNodes = new Map<string, number>();
  const propertyNodes = new Map<string, number>();
  const valueNodes = new Map<string, number>();
  const state = (name: string, data: SemanticState, color: string) => {
    const root = add(color);
    for (const [property, value] of Object.entries(data)) {
      const prop = getProperty(property);
      const val = getValue(property, value);
      const entry = add("state-entry");
      link(root, "entry", entry); link(entry, "property", prop); link(entry, "value", val);
    }
    stateNodes.set(name, root);
    return root;
  };
  const getProperty = (key: string) => {
    let id = propertyNodes.get(key);
    if (id === undefined) { id = add("property"); propertyNodes.set(key, id); }
    return id;
  };
  const valueKey = (property: string, value: unknown) => `${property}\0${stable(value)}`;
  const getValue = (property: string, value: unknown) => {
    const key = valueKey(property, value);
    let id = valueNodes.get(key);
    if (id === undefined) { id = add("value"); valueNodes.set(key, id); }
    return id;
  };

  state("initial", repository.initialState, "initial-state");
  state("target", target.snapshot, "target-state");
  let changeCount = 0; let bundleCount = 0; let parentCount = 0;
  for (const id of commitIds) {
    const commit = repository.commits[id];
    const cnode = commits.get(id)!;
    commit.parents.forEach((parent, index) => { const p = commits.get(parent); if (p !== undefined) { link(cnode, `parent:${index}`, p); parentCount++; } });
    if (commit.changes.length > 1) bundleCount++;
    for (const change of commit.changes) {
      const event = add("change"); link(cnode, "change", event);
      link(event, "property", getProperty(change.property));
      link(event, "from", getValue(change.property, change.from));
      link(event, "to", getValue(change.property, change.to));
      changeCount++;
    }
  }
  const mainHead = repository.branches.main;
  for (const [name, commit] of repository.branches ? Object.entries(repository.branches) : []) {
    const branch = add(name === "main" ? (name === repository.currentBranch ? "branch:main-current" : "branch:main") : (name === repository.currentBranch ? "branch:current" : "branch:other"));
    branchNodes.set(name, branch);
    const c = commits.get(commit); if (c !== undefined) link(branch, "points-to", c);
  }
  const head = commits.get(repository.head); if (head !== undefined) nodes[head].color += "|head";
  const targetBranchNode = branchNodes.get(target.branch);
  if (targetBranchNode !== undefined) link(stateNodes.get("target")!, "target-branch", targetBranchNode);
  // The initialized main head and current checkout are explicit roles, even for malformed inputs.
  const mainNode = commits.get(mainHead); if (mainNode !== undefined) nodes[mainNode].color += "|main-branch-head";
  const currentHead = commits.get(repository.branches[repository.currentBranch]); if (currentHead !== undefined) nodes[currentHead].color += "|current-branch-head";

  let colors = nodes.map(node => node.color);
  // Refinement labels use whole signatures, avoiding hash collisions.
  for (let round = 0; round <= nodes.length; round++) {
    const signatures = nodes.map((node, index) => stable({ self: colors[index], adjacent: node.edges.map(edge => [edge.label, colors[edge.to]]).sort((a, b) => stable(a).localeCompare(stable(b))) }));
    const palette = [...new Set(signatures)].sort();
    const next = signatures.map(signature => `c${palette.indexOf(signature)}`);
    if (next.every((value, index) => value === colors[index])) break;
    colors = next;
  }
  const edgeCounts = new Map<string, number>();
  nodes.forEach((node, from) => node.edges.forEach(edge => {
    const key = stable([colors[from], edge.label, colors[edge.to]]);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  }));
  const canonical = stable({ nodes: countColors(colors), edges: [...edgeCounts].sort(([a], [b]) => a.localeCompare(b)), rounds: nodes.length });
  return { canonical, summary: { commits: commitIds.length, branches: Object.keys(repository.branches).length, properties: propertyNodes.size, changes: changeCount, parents: parentCount, bundles: bundleCount } };
}

function countColors(colors: string[]) {
  const counts = new Map<string, number>(); for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
