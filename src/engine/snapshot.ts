import { GitSimulationError } from "./errors";
import { getCommit } from "./graph";
import type { Repository, SemanticChange, SemanticState } from "./types";
import { semanticEqual } from "./values";

export function getSnapshot(
  repository: Repository,
  commitId = repository.head,
): SemanticState {
  const memo = new Map<string, SemanticState>();
  const visiting = new Set<string>();

  const calculate = (id: string): SemanticState => {
    const cached = memo.get(id);
    if (cached) return structuredClone(cached);
    if (visiting.has(id)) {
      throw new GitSimulationError("The commit graph contains a cycle.");
    }

    visiting.add(id);
    const commit = getCommit(repository, id);
    const parentState = commit.parents[0]
      ? calculate(commit.parents[0])
      : structuredClone(repository.initialState);
    const snapshot = applyChangesUnchecked(parentState, commit.changes);
    visiting.delete(id);
    memo.set(id, snapshot);
    return structuredClone(snapshot);
  };

  return calculate(commitId);
}

export function applyChanges(
  snapshot: SemanticState,
  changes: SemanticChange[],
): SemanticState {
  const result = structuredClone(snapshot);

  for (const change of changes) {
    if (!semanticEqual(result[change.property], change.from)) {
      throw new GitSimulationError(
        `Merge conflict on \`${change.property}\`: this change expects ${formatValue(change.from)}, but here it is ${formatValue(result[change.property])}.\n\nConflict resolution is not supported in this version.`,
      );
    }
    result[change.property] = structuredClone(change.to);
  }

  return result;
}

export function diffSnapshots(
  from: SemanticState,
  to: SemanticState,
): SemanticChange[] {
  const properties = new Set([...Object.keys(from), ...Object.keys(to)]);
  return [...properties]
    .sort()
    .filter((property) => !semanticEqual(from[property], to[property]))
    .map((property) => ({
      type: "set" as const,
      property,
      from: structuredClone(from[property]),
      to: structuredClone(to[property]),
    }));
}

function applyChangesUnchecked(
  snapshot: SemanticState,
  changes: SemanticChange[],
): SemanticState {
  const result = structuredClone(snapshot);
  for (const change of changes) {
    result[change.property] = structuredClone(change.to);
  }
  return result;
}

function formatValue(value: unknown): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}
