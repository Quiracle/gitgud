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

/** Every command badge, locked ones included, in catalog order, with how often each was typed. */
export function useCommandAchievements() {
  const learned = useLearnedCommands();
  const [counts, setCounts] = useState(() => openProgressStore().commandCounts());

  useEffect(() => {
    const refresh = () => setCounts(openProgressStore().commandCounts());
    window.addEventListener(PROGRESS_CHANGED, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return commandAchievements(learned, counts);
}
