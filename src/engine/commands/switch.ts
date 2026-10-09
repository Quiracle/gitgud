import { cloneRepository } from "../clone";
import { GitSimulationError } from "../errors";
import type { Repository } from "../types";
import type { MutationResult } from "./shared";

export function switchBranch(
  source: Repository,
  branch: string,
): MutationResult {
  const branchHead = source.branches[branch];
  if (!branchHead) {
    throw new GitSimulationError(`Unknown branch: ${branch}`);
  }

  if (source.currentBranch === branch) {
    return {
      repository: source,
      output: [`Already on '${branch}'.`],
      mutated: false,
    };
  }

  const repository = cloneRepository(source);
  repository.currentBranch = branch;
  repository.head = branchHead;
  return {
    repository,
    output: [`Switched to branch '${branch}'.`],
    mutated: true,
  };
}
