import { GitSimulationError } from "./errors";
import type { Commit, Repository } from "./types";

export function getCommit(repository: Repository, commitId: string): Commit {
  const commit = repository.commits[commitId];
  if (!commit) {
    throw new GitSimulationError(`Unknown commit: ${commitId}`);
  }
  return commit;
}

export function getAncestorDistances(
  repository: Repository,
  startId: string,
): Map<string, number> {
  getCommit(repository, startId);
  const distances = new Map<string, number>();
  const queue: Array<{ id: string; distance: number }> = [
    { id: startId, distance: 0 },
  ];

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) break;

    const knownDistance = distances.get(next.id);
    if (knownDistance !== undefined && knownDistance <= next.distance) continue;
    distances.set(next.id, next.distance);

    for (const parent of getCommit(repository, next.id).parents) {
      queue.push({ id: parent, distance: next.distance + 1 });
    }
  }

  return distances;
}

export function isAncestor(
  repository: Repository,
  ancestorId: string,
  descendantId: string,
): boolean {
  return getAncestorDistances(repository, descendantId).has(ancestorId);
}

export function findMergeBase(
  repository: Repository,
  leftId: string,
  rightId: string,
): string {
  const left = getAncestorDistances(repository, leftId);
  const right = getAncestorDistances(repository, rightId);
  const common = [...left.keys()].filter((id) => right.has(id));

  if (common.length === 0) {
    throw new GitSimulationError("The branches do not share a common ancestor.");
  }

  common.sort((a, b) => {
    const distanceA = (left.get(a) ?? 0) + (right.get(a) ?? 0);
    const distanceB = (left.get(b) ?? 0) + (right.get(b) ?? 0);
    return distanceA - distanceB || a.localeCompare(b);
  });

  return common[0];
}

export function getReachableCommits(
  repository: Repository,
  startId = repository.head,
): Commit[] {
  return getReachableCommitsFrom(repository, [startId]);
}

export function getReachableCommitsFrom(
  repository: Repository,
  startIds: string[],
): Commit[] {
  const commits: Commit[] = [];
  const visited = new Set<string>();
  const queue = [...startIds];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);

    const commit = getCommit(repository, id);
    commits.push(commit);
    queue.push(...commit.parents);
  }

  return commits;
}

export function branchesAtCommit(repository: Repository, commitId: string): string[] {
  return Object.entries(repository.branches)
    .filter(([, head]) => head === commitId)
    .map(([branch]) => branch)
    .sort();
}
