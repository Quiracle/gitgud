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
    return [`commit ${commit.id}${refs}`, `    ${commit.message}`];
  });

  if (all) {
    output.unshift("Showing commits reachable from all branches:");
  }

  return { repository, output, mutated: false };
}
