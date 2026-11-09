import { branchesAtCommit, getReachableCommitsFrom } from "../graph";
import type { Repository } from "../types";
import type { MutationResult } from "./shared";

export function showLog(repository: Repository, all: boolean): MutationResult {
  const otherBranchHeads = Object.entries(repository.branches)
    .filter(([branch]) => branch !== repository.currentBranch)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, head]) => head);
  const startIds = all ? [repository.head, ...otherBranchHeads] : [repository.head];

  const output = getReachableCommitsFrom(repository, startIds).flatMap((commit) => {
    const branches = branchesAtCommit(repository, commit.id);
    const refs = branches.length > 0 ? ` (${branches.join(", ")})` : "";
    // Like real Git, merge commits list their parents, so the history's shape reads as text.
    const merge = commit.parents.length > 1 ? [`Merge: ${commit.parents.join(" ")}`] : [];
    return [`commit ${commit.id}${refs}`, ...merge, `    ${commit.message}`];
  });

  if (all) {
    output.unshift("Showing commits reachable from all branches:");
  }

  return { repository, output, mutated: false };
}
