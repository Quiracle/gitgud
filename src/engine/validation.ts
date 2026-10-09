import { getReachableCommits } from "./graph";
import { getSnapshot } from "./snapshot";
import type { PuzzleTarget, Repository, ValidationResult } from "./types";
import { semanticEqual } from "./values";

export function validateRepository(
  repository: Repository,
  target: PuzzleTarget,
): ValidationResult {
  const unmet: string[] = [];
  const targetHead = repository.branches[target.branch];

  if (!targetHead) {
    unmet.push(`The required branch '${target.branch}' does not exist.`);
  } else {
    const actual = getSnapshot(repository, targetHead);
    if (!semanticEqual(actual, target.snapshot)) {
      unmet.push(
        `Branch '${target.branch}' does not contain the target repository state.`,
      );
    }
  }

  if (repository.currentBranch !== target.branch) {
    unmet.push(`HEAD must finish on branch '${target.branch}'.`);
  }

  for (const [branch, expectedHead] of Object.entries(target.branchHeads ?? {})) {
    if (repository.branches[branch] !== expectedHead) {
      unmet.push(`Branch '${branch}' does not point to the required commit.`);
    }
  }

  if (target.requiredProvenance?.length) {
    const reachable = getReachableCommits(repository);
    for (const requirement of target.requiredProvenance) {
      const found = reachable.some(
        (commit) =>
          commit.provenance?.type === requirement.type &&
          commit.provenance.sourceCommits?.includes(requirement.sourceCommit),
      );
      if (!found) {
        unmet.push(
          `History must include a ${requirement.type} of '${requirement.sourceCommit}'.`,
        );
      }
    }
  }

  return { solved: unmet.length === 0, unmet };
}
