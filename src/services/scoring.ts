export const SCORING_POLICY_VERSION = 1 as const;

export interface RankedResult {
  elapsedMs: number;
  restartCount: number;
  commandCount: number;
  completedAt: string;
}

/** Negative means `left` ranks ahead of `right`. Mirrors the leaderboard SQL ordering. */
export function compareRankedResults(left: RankedResult, right: RankedResult): number {
  return (
    left.elapsedMs - right.elapsedMs ||
    left.restartCount - right.restartCount ||
    left.commandCount - right.commandCount ||
    Date.parse(left.completedAt) - Date.parse(right.completedAt)
  );
}
