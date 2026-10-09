import { cloneRepository } from "../clone";
import { GitSimulationError } from "../errors";
import type { Repository } from "../types";
import type { MutationResult } from "./shared";

export function switchBranch(
  source: Repository,
  branch: string,
): MutationResult {
  if (!Object.hasOwn(source.branches, branch)) {
    throw new GitSimulationError(`Unknown branch: ${branch}`);
  }
  const branchHead = source.branches[branch];

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
