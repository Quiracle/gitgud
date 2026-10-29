import { planInteractiveRebase, type Repository } from "../../engine";

/**
 * Representatives for NEW daily-winning snapshots with exactly one move left.
 * Never use this to deduplicate intermediate histories or guided-lesson wins.
 *
 * Squash partitions can change history, but in this engine every group replays
 * the same ordered patches before taking its net diff. All-pick can additionally
 * skip an already-applied patch; it cannot fail where a grouping succeeds. By
 * induction over those patches, every successful grouping's final snapshot is
 * also reached by all-pick. Keep explicit interactive all-pick because ordinary
 * rebase can short-circuit on an ancestor whereas interactive rebase flattens.
 */
export function dailyTerminalCommands(repository: Repository): string[] {
  if (repository.currentBranch !== "main") return ["git switch main"];
  const commands: string[] = [];
  for (const branch of Object.keys(repository.branches).sort()) {
    if (branch !== "main") commands.push(`git merge ${branch}`, `git rebase ${branch}`);
    const plan = planInteractiveRebase(repository, branch);
    if (plan.ok && plan.todo.length) commands.push(`git rebase -i ${branch}\n${plan.todo.map(item => `pick ${item.commit}`).join("\n")}`);
  }
  for (const commit of Object.values(repository.commits)) {
    if (commit.parents.length > 1) continue;
    commands.push(`git cherry-pick ${commit.id}`, `git revert ${commit.id}`);
  }
  return commands;
}
