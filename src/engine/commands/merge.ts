import { cloneRepository } from "../clone";
import { GitSimulationError } from "../errors";
import { findMergeBase, isAncestor } from "../graph";
import { diffSnapshots, getSnapshot } from "../snapshot";
import type { Repository, SemanticState } from "../types";
import { semanticEqual } from "../values";
import { appendGeneratedCommit, type MutationResult } from "./shared";

export function mergeBranch(
  source: Repository,
  branch: string,
  ffOnly: boolean,
): MutationResult {
  const targetHead = source.branches[branch];
  if (!targetHead) {
    throw new GitSimulationError(`Unknown branch: ${branch}`);
  }

  if (branch === source.currentBranch) {
    return { repository: source, output: ["Already up to date."], mutated: false };
  }

  if (isAncestor(source, targetHead, source.head)) {
    return { repository: source, output: ["Already up to date."], mutated: false };
  }

  if (isAncestor(source, source.head, targetHead)) {
    const repository = cloneRepository(source);
    const previousHead = repository.head;
    repository.head = targetHead;
    repository.branches[repository.currentBranch] = targetHead;
    return {
      repository,
      output: [`Updating ${previousHead}..${targetHead}`, "Fast-forward"],
      mutated: true,
    };
  }

  if (ffOnly) {
    throw new GitSimulationError(
      "Not possible to fast-forward. The branches have diverged.",
    );
  }

  const baseId = findMergeBase(source, source.head, targetHead);
  const base = getSnapshot(source, baseId);
  const ours = getSnapshot(source, source.head);
  const theirs = getSnapshot(source, targetHead);
  const merged = mergeSnapshots(base, ours, theirs);
  const changes = diffSnapshots(ours, merged);
  const previousHead = source.head;
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Merge branch '${branch}' into ${source.currentBranch}`,
    [previousHead, targetHead],
    changes,
    { type: "merge", sourceCommits: [targetHead] },
  );

  return {
    repository,
    output: [
      `Merge made by the simulated strategy.`,
      `[${source.currentBranch} ${commit.id}] ${commit.message}`,
    ],
    mutated: true,
  };
}

function mergeSnapshots(
  base: SemanticState,
  ours: SemanticState,
  theirs: SemanticState,
): SemanticState {
  const merged = structuredClone(ours);
  const properties = new Set([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);

  for (const property of properties) {
    const baseValue = base[property];
    const ourValue = ours[property];
    const theirValue = theirs[property];

    if (semanticEqual(ourValue, theirValue)) continue;
    if (semanticEqual(ourValue, baseValue)) {
      merged[property] = structuredClone(theirValue);
      continue;
    }
    if (semanticEqual(theirValue, baseValue)) continue;

    throw new GitSimulationError(
      `Merge conflict on \`${property}\`.\n\nConflict resolution is not supported in this version.`,
    );
  }

  return merged;
}
