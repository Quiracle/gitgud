import { validateRepository, type GitAction, type PuzzleTarget, type Repository, type ValidationResult } from "../engine";
import type { ActionRequirement } from "./types";

/** A transcript entry may carry an action alongside future command metadata. */
export type ExecutedAction = GitAction | { action: GitAction };

/**
 * Applies the ordinary repository validator and independent, unordered action
 * requirements. It never treats a transcript as a prescribed command sequence.
 */
export function validatePuzzleCompletion(
  repository: Repository,
  target: PuzzleTarget,
  executed: readonly ExecutedAction[],
  requirements: readonly ActionRequirement[] = [],
): ValidationResult {
  const base = validateRepository(repository, target);
  const actions = executed.map((entry) => "action" in entry ? entry.action : entry);
  const unmet = [...base.unmet];

  requirements.forEach((requirement) => {
    if (!actions.some((action) => matchesActionRequirement(action, requirement))) {
      unmet.push(`A required action has not been executed: ${formatRequirement(requirement)}.`);
    }
  });

  return { solved: unmet.length === 0, unmet };
}

export function matchesActionRequirement(
  action: GitAction,
  requirement: ActionRequirement,
): boolean {
  if (action.type !== requirement.type) return false;

  switch (action.type) {
    case "log":
      return requirement.type === "log" && action.all === requirement.all;
    case "merge":
      return requirement.type === "merge" && action.ffOnly === requirement.ffOnly;
    case "switch":
      return requirement.type === "switch" && (requirement.branch === undefined || action.branch === requirement.branch);
    case "cherry-pick":
    case "revert":
      return requirement.type === action.type && (requirement.commit === undefined || action.commit === requirement.commit);
  }
}

function formatRequirement(requirement: ActionRequirement): string {
  switch (requirement.type) {
    case "log":
      return requirement.all ? "git log --all" : "git log";
    case "merge":
      return requirement.ffOnly ? "git merge --ff-only <branch>" : "git merge <branch>";
    case "switch":
      return requirement.branch ? `git switch ${requirement.branch}` : "git switch";
    case "cherry-pick":
      return requirement.commit ? `git cherry-pick ${requirement.commit}` : "git cherry-pick";
    case "revert":
      return requirement.commit ? `git revert ${requirement.commit}` : "git revert";
  }
}
