import type { PuzzleCandidate } from "../types";
import { refreshTemplateHints } from "./editorial";
import { searchDailyPuzzle, type SearchLimits } from "./quality";

/**
 * Runs the exhaustive solver once, at generation, because it is far too slow for a browser
 * or Edge Function. Hints and the give-up solution both read the route it leaves behind.
 * Returns undefined when the budget runs out: an unfinished search proves nothing.
 */
export function settleShortestRoute(
  candidate: PuzzleCandidate,
  excludedThroughDepth: number,
  limits: Omit<SearchLimits, "maxDepth">,
): { candidate: PuzzleCandidate; excludedThroughDepth: number } | undefined {
  const known = candidate.solutionCommands.length;
  if (known === excludedThroughDepth + 1) return { candidate, excludedThroughDepth };
  const search = searchDailyPuzzle(candidate, { ...limits, maxDepth: known - 1 });
  if (search.status === "budget-exhausted") return undefined;
  const route = search.shortestCommands ?? candidate.solutionCommands;
  return {
    candidate: refreshTemplateHints({ ...candidate, solutionCommands: route }, "procedural"),
    excludedThroughDepth: route.length - 1,
  };
}
