import { executeCommand, getSnapshot, type Repository } from "../../engine";
import { validatePuzzleCompletion } from "../completion";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate } from "../types";
import { dailySearchCommands, repositorySearchKey, type SearchLimits } from "./quality";
import { snapshotKey } from "./procedural";

export interface ProposalVerdict {
  candidate: PuzzleCandidate;
  status: "certified" | "shortcut" | "unknown";
  shortcut?: string[];
}

/**
 * Evaluate many targets on ONE repository in one exhaustive search. The entire
 * repository, including unreachable commits, remains in the search key. Target
 * snapshots are only lookup keys for daily wins, never state-deduplication keys.
 * A budget limit never certifies a surviving proposal.
 */
export function certifyProceduralBatch(candidates: readonly PuzzleCandidate[], limits: SearchLimits & { maxElapsedMs?: number }) {
  const maxStates = limits.maxStates ?? 100_000;
  const maxTransitions = limits.maxTransitions ?? 1_000_000;
  const maxInteractivePlans = limits.maxInteractivePlans ?? 4096;
  if (![maxStates, maxTransitions, maxInteractivePlans].every(n => Number.isInteger(n) && n > 0) || !Number.isInteger(limits.maxDepth) || limits.maxDepth < 0) throw new Error("Invalid certification budget.");
  if (limits.maxElapsedMs !== undefined && (!Number.isFinite(limits.maxElapsedMs) || limits.maxElapsedMs <= 0)) throw new Error("Invalid time budget.");
  const deadline = limits.maxElapsedMs === undefined ? Infinity : Date.now() + limits.maxElapsedMs;
  const verdicts: ProposalVerdict[] = candidates.map(candidate => ({ candidate, status: "unknown" }));
  let transitions = 0;
  let exploredStates = 0;
  let excludedThroughDepth = 0;
  if (!candidates.length) return { verdicts, transitions, exploredStates, excludedThroughDepth };
  const initial = candidates[0].initialRepository;
  const initialKey = repositorySearchKey(initial);
  for (const candidate of candidates) {
    if (candidate.kind !== "daily" || candidate.target.branch !== "main" || repositorySearchKey(candidate.initialRepository) !== initialKey) throw new Error("Batch targets must share a daily repository.");
    const valid = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    if (!valid.ok || valid.value.puzzle.parCommands !== limits.maxDepth + 1) throw new Error("Every proposal needs a valid proof exactly one step beyond the excluded depths.");
  }
  const pending = new Map<string, ProposalVerdict[]>();
  for (const verdict of verdicts) {
    const key = snapshotKey(verdict.candidate.target.snapshot);
    pending.set(key, [...pending.get(key) ?? [], verdict]);
  }
  interface Node { repository: Repository; path: string[] }
  let frontier: Node[] = [{ repository: initial, path: [] }];
  const seen = new Set([initialKey]);
  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    const next: Node[] = [];
    for (const node of frontier) {
      if (exploredStates >= maxStates || Date.now() >= deadline) return { verdicts, transitions, exploredStates, excludedThroughDepth };
      exploredStates++;
      const enumeration = dailySearchCommands(node.repository, maxInteractivePlans);
      if (!enumeration.complete) return { verdicts, transitions, exploredStates, excludedThroughDepth };
      for (const command of enumeration.commands) {
        if (transitions >= maxTransitions) return { verdicts, transitions, exploredStates, excludedThroughDepth };
        transitions++;
        const step = executeCommand(node.repository, command);
        if (!step.ok || !step.mutated) continue;
        const path = [...node.path, command];
        if (step.repository.currentBranch === "main") {
          const key = snapshotKey(getSnapshot(step.repository, step.repository.branches.main));
          for (const verdict of pending.get(key) ?? []) {
            if (!validatePuzzleCompletion(verdict.candidate, step.repository, []).solved) throw new Error("Daily target lookup disagreed with normal victory validation.");
            verdict.status = "shortcut";
            verdict.shortcut = path;
          }
          pending.delete(key);
          if (!pending.size) return { verdicts, transitions, exploredStates, excludedThroughDepth };
        }
        if (depth === limits.maxDepth) continue;
        const key = repositorySearchKey(step.repository);
        if (seen.has(key)) continue;
        if (seen.size >= maxStates) return { verdicts, transitions, exploredStates, excludedThroughDepth };
        seen.add(key);
        next.push({ repository: step.repository, path });
      }
    }
    excludedThroughDepth = depth;
    frontier = next;
    if (!frontier.length) { excludedThroughDepth = limits.maxDepth; break; }
  }
  for (const verdict of verdicts) if (verdict.status === "unknown") verdict.status = "certified";
  return { verdicts, transitions, exploredStates, excludedThroughDepth };
}
