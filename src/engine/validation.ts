import { getReachableCommits } from "./graph";
import { getSnapshot } from "./snapshot";
import type { GoalCheck, PuzzleTarget, Repository, RequiredProvenance, ValidationResult } from "./types";
import { semanticEqual } from "./values";

export function validateRepository(
  repository: Repository,
  target: PuzzleTarget,
): ValidationResult {
  const unmet: string[] = [];
  const checks: GoalCheck[] = [];
  const targetHead = Object.hasOwn(repository.branches, target.branch)
    ? repository.branches[target.branch]
    : undefined;

  const matchesSnapshot =
    targetHead !== undefined && semanticEqual(getSnapshot(repository, targetHead), target.snapshot);
  if (targetHead === undefined) {
    unmet.push(`The required branch '${target.branch}' does not exist.`);
  } else if (!matchesSnapshot) {
    unmet.push(
      `Branch '${target.branch}' does not contain the target repository state.`,
    );
  }
  checks.push({
    id: "snapshot",
    label: `${target.branch} matches the goal`,
    met: matchesSnapshot,
    goal: { type: "snapshot", branch: target.branch },
  });

  const onTarget = repository.currentBranch === target.branch;
  if (!onTarget) {
    unmet.push(`HEAD must finish on branch '${target.branch}'.`);
  }
  checks.push({ id: "head", label: `Finish on ${target.branch}`, met: onTarget, goal: { type: "head", branch: target.branch } });

  for (const [branch, expectedHead] of Object.entries(target.branchHeads ?? {})) {
    const met = Object.hasOwn(repository.branches, branch) && repository.branches[branch] === expectedHead;
    if (!met) {
      unmet.push(`Branch '${branch}' does not point to the required commit.`);
    }
    checks.push({
      id: `branch:${branch}`,
      label: `Leave ${branch} at ${expectedHead}`,
      met,
      goal: { type: "branch-head", branch, commit: expectedHead },
    });
  }

  if (target.requiredProvenance?.length) {
    const reachable = getReachableCommits(repository);
    const squashes: { sourceCommit: string; met: boolean }[] = [];
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
      // Squash sources usually describe one combined commit, so they share a single goal.
      if (requirement.type === "squash") squashes.push({ sourceCommit: requirement.sourceCommit, met: found });
      else checks.push({
        id: `${requirement.type}:${requirement.sourceCommit}`,
        label: provenanceLabel(requirement),
        met: found,
        goal: { type: "provenance", provenance: requirement.type, commits: [requirement.sourceCommit] },
      });
    }
    if (squashes.length) {
      const sources = squashes.map((squash) => squash.sourceCommit);
      checks.push({
        id: `squash:${sources.join(",")}`,
        label: `Squash ${joinWords(sources)} into one commit`,
        met: squashes.every((squash) => squash.met),
        goal: { type: "provenance", provenance: "squash", commits: sources },
      });
    }
  }

  return { solved: unmet.length === 0, unmet, checks };
}

function provenanceLabel({ type, sourceCommit }: RequiredProvenance): string {
  switch (type) {
    case "revert":
      return `Undo ${sourceCommit} with git revert`;
    case "merge":
      return `Bring in ${sourceCommit} with a merge commit`;
    case "cherry-pick":
      return `Cherry-pick ${sourceCommit}`;
    case "rebase":
      return `Rebase ${sourceCommit} onto newer work (don't merge it)`;
    case "squash":
      return `Squash ${sourceCommit} into a combined commit`;
    case "original":
      return `Keep ${sourceCommit} in the history`;
  }
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}
