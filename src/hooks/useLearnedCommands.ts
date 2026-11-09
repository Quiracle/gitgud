import { useEffect, useState } from "react";
import { commandAchievements, type LearnedCommands } from "../lib/learnedCommands";
import { openProgressStore, PROGRESS_CHANGED } from "../storage/browserProgress";

/** Commands this browser has seen the player type, kept current as they play. */
export function useLearnedCommands(): LearnedCommands {
  const [learned, setLearned] = useState(() => openProgressStore().learnedCommands());

  useEffect(() => {
    const refresh = () => setLearned(openProgressStore().learnedCommands());
    window.addEventListener(PROGRESS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return learned;
}

/** Every command badge, locked ones included, in catalog order. */
export function useCommandAchievements() {
  return commandAchievements(useLearnedCommands());
}
