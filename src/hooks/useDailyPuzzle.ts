import { useCallback, useEffect, useState } from "react";
import type { PublicPuzzleDefinition } from "../puzzles";
import { createDailyPuzzleSource, utcDate } from "../services/dailyPuzzles";

export type DailyPuzzleState =
  | { status: "loading" }
  | { status: "ready"; puzzle: PublicPuzzleDefinition }
  | { status: "error"; message: string };

/** Loads the shared official puzzle for the canonical UTC date. */
export function useDailyPuzzle(date = utcDate()) {
  const [state, setState] = useState<DailyPuzzleState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const puzzle = await createDailyPuzzleSource().getByDate(date);
      setState({ status: "ready", puzzle });
    } catch (reason) {
      setState({ status: "error", message: reason instanceof Error ? reason.message : "Unable to load today's puzzle." });
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, date, reload: load };
}
