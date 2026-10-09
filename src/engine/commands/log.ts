import { branchesAtCommit, getReachableCommits } from "../graph";
import type { Repository } from "../types";
import type { MutationResult } from "./shared";

export function showLog(repository: Repository): MutationResult {
  const output = getReachableCommits(repository).flatMap((commit) => {
    const branches = branchesAtCommit(repository, commit.id);
    const refs = branches.length > 0 ? ` (${branches.join(", ")})` : "";
    return [`commit ${commit.id}${refs}`, `    ${commit.message}`];
  });

  return { repository, output, mutated: false };
}
