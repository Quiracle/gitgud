import {
  executeCommand, getSnapshot, planInteractiveRebase,
  type Repository, type SemanticChange,
} from "../../engine";
import { semanticEqual } from "../../engine/values";
import { validatePuzzleCompletion } from "../completion";
import type { PublicPuzzleDefinition } from "../types";

export const DAILY_EVALUATOR_VERSION = 1;

export interface SearchLimits {
  /** Every state-changing command, including switching, costs one. */
  maxDepth: number;
  maxStates?: number;
  maxTransitions?: number;
  maxInteractivePlans?: number;
}

export interface DailySearchResult {
  status: "solved" | "exhausted" | "budget-exhausted";
  /** Only present after breadth-first search has proved this is shortest. */
  shortestCommands?: string[];
  /** All routes of this length or less have been ruled out. */
  excludedThroughDepth: number;
  exploredStates: number;
  transitions: number;
  reason?: "states" | "transitions" | "interactive-plans";
}

/**
 * A daily-only oracle. It uses the game's actual transitions and victory rule.
 * It never equates repositories just because their visible snapshots match.
 * Generated IDs, parent order, branch heads and even detached commits are kept:
 * a later pick/revert can refer to any commit, and merge-base tie breaks use IDs.
 */
export function searchDailyPuzzle(puzzle: PublicPuzzleDefinition, limits: SearchLimits): DailySearchResult {
  if (puzzle.kind !== "daily") throw new Error("The daily search requires a daily puzzle.");
  if (!Number.isInteger(limits.maxDepth) || limits.maxDepth < 0) throw new Error("Invalid search depth.");
  const maxStates = limits.maxStates ?? 100_000;
  const maxTransitions = limits.maxTransitions ?? 1_000_000;
  const maxInteractivePlans = limits.maxInteractivePlans ?? 4096;
  for (const limit of [maxStates, maxTransitions, maxInteractivePlans]) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Search budgets must be positive integers.");
  }
  let exploredStates = 0;
  let transitions = 0;
  let excludedThroughDepth = -1;
  const result = (status: DailySearchResult["status"], extra: Partial<DailySearchResult> = {}): DailySearchResult => ({
    status, excludedThroughDepth, exploredStates, transitions, ...extra,
  });
  if (validatePuzzleCompletion(puzzle, puzzle.initialRepository, []).solved) {
    return result("solved", { shortestCommands: [] });
  }
  excludedThroughDepth = 0;
  interface Node { repository: Repository; path: string[] }
  let frontier: Node[] = [{ repository: puzzle.initialRepository, path: [] }];
  const seen = new Set([repositorySearchKey(puzzle.initialRepository)]);
  for (let depth = 1; depth <= limits.maxDepth; depth += 1) {
    const next: Node[] = [];
    for (const node of frontier) {
      if (exploredStates >= maxStates) return result("budget-exhausted", { reason: "states" });
      exploredStates += 1;
      const enumeration = dailySearchCommands(node.repository, maxInteractivePlans);
      // Missing even one squash partition makes a shortest-path claim unsound.
      if (!enumeration.complete) return result("budget-exhausted", { reason: "interactive-plans" });
      for (const command of enumeration.commands) {
        if (transitions >= maxTransitions) return result("budget-exhausted", { reason: "transitions" });
        transitions += 1;
        const step = executeCommand(node.repository, command);
        if (!step.ok || !step.mutated) continue;
        const path = [...node.path, command];
        if (validatePuzzleCompletion(puzzle, step.repository, []).solved) {
          return result("solved", { shortestCommands: path });
        }
        if (depth === limits.maxDepth) continue;
        const key = repositorySearchKey(step.repository);
        if (seen.has(key)) continue;
        if (seen.size >= maxStates) return result("budget-exhausted", { reason: "states" });
        seen.add(key);
        next.push({ repository: step.repository, path });
      }
    }
    excludedThroughDepth = depth;
    if (next.length === 0 && depth < limits.maxDepth) {
      // No new state is reachable, so the remaining bounded depths are exhausted too.
      excludedThroughDepth = limits.maxDepth;
      break;
    }
    frontier = next;
  }
  return result("exhausted");
}

/** Aliases, log, and --ff-only add no reachable daily states beyond these commands. */
export function dailySearchCommands(repository: Repository, maxInteractivePlans = 4096): { commands: string[]; complete: boolean } {
  const commands: string[] = [];
  for (const branch of Object.keys(repository.branches).sort()) {
    if (branch !== repository.currentBranch) {
      commands.push(`git merge ${branch}`, `git rebase ${branch}`, `git switch ${branch}`);
    }
    const plan = planInteractiveRebase(repository, branch);
    if (!plan.ok) continue;
    const count = 2 ** Math.max(0, plan.todo.length - 1);
    if (count > maxInteractivePlans) return { commands, complete: false };
    for (let mask = 0; mask < count; mask += 1) {
      const todo = plan.todo.map((item, index) => `${index > 0 && Math.floor(mask / 2 ** (index - 1)) % 2 ? "squash" : "pick"} ${item.commit}`);
      commands.push(`git rebase -i ${branch}${todo.length ? `\n${todo.join("\n")}` : ""}`);
    }
  }
  const snapshot = getSnapshot(repository);
  for (const commit of Object.values(repository.commits).sort((a, b) => a.id.localeCompare(b.id))) {
    if (commit.parents.length > 1) continue;
    // Exact semantic preconditions avoid throwing for the many inapplicable edits.
    if (canApply(snapshot, commit.changes)) commands.push(`git cherry-pick ${commit.id}`);
    const inverse = [...commit.changes].reverse().map(change => ({ ...change, from: change.to, to: change.from }));
    if (canApply(snapshot, inverse)) commands.push(`git revert ${commit.id}`);
  }
  return { commands, complete: true };
}

function canApply(snapshot: Record<string, unknown>, changes: SemanticChange[]) {
  const current = { ...snapshot };
  for (const change of changes) {
    if (!semanticEqual(current[change.property], change.from)) return false;
    current[change.property] = change.to;
  }
  return true;
}

export function repositorySearchKey(repository: Repository): string {
  // Prose and provenance do not affect simulator transitions or daily victory.
  return JSON.stringify([
    repository.initialState, repository.currentBranch, repository.head,
    Object.entries(repository.branches).sort(([a], [b]) => a.localeCompare(b)),
    repository.nextGeneratedId,
    Object.values(repository.commits).sort((a, b) => a.id.localeCompare(b.id)).map(commit => [commit.id, commit.parents, commit.changes]),
  ]);
}
