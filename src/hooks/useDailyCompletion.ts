import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { PublicPuzzleDefinition } from "../puzzles";
import { getSyncedDailyCompletion } from "../services/syncedProgress";
import { openProgressStore, PROGRESS_CHANGED } from "../storage/browserProgress";
import type { CompletionRecord } from "../storage/progress";

interface DailyCompletionState {
  completion?: CompletionRecord;
  loading: boolean;
}

/** Merges a guest's browser cache with the signed-in player's Supabase completion. */
export function useDailyCompletion(
  puzzle: Pick<PublicPuzzleDefinition, "id" | "version" | "kind"> | undefined,
): DailyCompletionState {
  const { status, user } = useAuth();
  const [state, setState] = useState<DailyCompletionState>({ loading: false });

  useEffect(() => {
    if (!puzzle || puzzle.kind !== "daily") {
      setState({ loading: false });
      return;
    }
    let active = true;
    const local = () => openProgressStore().latestCompletion(puzzle.id, puzzle.version);
    const refreshLocal = () => active && setState((current) => ({ ...current, completion: current.completion ?? local() }));
    const localCompletion = local();
    window.addEventListener(PROGRESS_CHANGED, refreshLocal);
    window.addEventListener("storage", refreshLocal);

    if (status !== "authenticated" || !user) {
      setState({ completion: localCompletion, loading: status === "loading" });
    } else {
      setState({ completion: localCompletion, loading: true });
      getSyncedDailyCompletion(puzzle.id, puzzle.version)
        .then((remote) => {
          if (active) setState({ completion: remote ?? local(), loading: false });
        })
        .catch(() => {
          // Offline or unavailable Supabase never prevents the local game from opening.
          if (active) setState({ completion: local(), loading: false });
        });
    }

    return () => {
      active = false;
      window.removeEventListener(PROGRESS_CHANGED, refreshLocal);
      window.removeEventListener("storage", refreshLocal);
    };
  }, [puzzle?.id, puzzle?.kind, puzzle?.version, status, user?.id]);

  return state;
}
