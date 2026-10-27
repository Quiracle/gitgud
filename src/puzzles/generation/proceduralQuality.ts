import { executeCommand, getSnapshot, parseGitCommand, type Repository } from "../../engine";
import { validatePuzzleCompletion } from "../completion";
import type { PuzzleCandidate } from "../types";
import { snapshotKey } from "./procedural";

/**
 * A secondary rejection check, never the general difficulty certificate.
 * With ONLY cherry-picks available, generated copies have exactly the same
 * patches as their originals. Snapshot deduplication is sound for this restricted
 * check; it would be unsound for the full merge/revert/rebase oracle.
 */
export function findCopyOnlySolution(candidate: PuzzleCandidate, maxDepth = candidate.solutionCommands.length): string[] | undefined {
  if (candidate.kind !== "daily" || candidate.initialRepository.currentBranch !== "main") throw new Error("Expected a daily starting on main.");
  if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 20) throw new Error("Invalid copy-only search depth.");
  const commands = Object.keys(candidate.initialRepository.commits).sort().map(id => `git cherry-pick ${id}`);
  let frontier: { repository: Repository; path: string[] }[] = [{ repository: candidate.initialRepository, path: [] }];
  const seen = new Set([snapshotKey(getSnapshot(candidate.initialRepository))]);
  if (validatePuzzleCompletion(candidate, candidate.initialRepository, []).solved) return [];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: typeof frontier = [];
    for (const node of frontier) for (const command of commands) {
      const step = executeCommand(node.repository, command);
      if (!step.ok || !step.mutated) continue;
      const path = [...node.path, command];
      if (validatePuzzleCompletion(candidate, step.repository, []).solved) return path;
      const key = snapshotKey(getSnapshot(step.repository));
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({ repository: step.repository, path });
    }
    frontier = next;
    if (!frontier.length) return undefined;
  }
  return undefined;
}

/** Coarse pacing signal, NOT proof that two puzzles require different reasoning. */
export function solutionCommandPattern(candidate: PuzzleCandidate): string {
  return candidate.solutionCommands.map(command => {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) throw new Error("Invalid proof command.");
    return parsed.action.type === "interactive-rebase" && parsed.action.todo?.some(item => item.action === "squash") ? "squash" : parsed.action.type;
  }).join(" → ");
}
