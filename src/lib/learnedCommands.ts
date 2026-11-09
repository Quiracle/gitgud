/**
 * Commands learned: one badge per Git command the simulator supports, earned the first time
 * the player types a command line using it, whether or not that line succeeds.
 * Ids are stable: saved progress and copy are keyed by them. Order follows Learn Basics.
 */
export const LEARNABLE_COMMANDS = [
  "log",
  "switch",
  "merge",
  "cherry-pick",
  "revert",
  "rebase",
  "interactive-rebase",
] as const;

export type LearnableCommand = (typeof LEARNABLE_COMMANDS)[number];

/** When each command was first typed (ISO timestamp). */
export type LearnedCommands = Partial<Record<LearnableCommand, string>>;

export interface CommandAchievement {
  id: LearnableCommand;
  unlocked: boolean;
  unlockedAt?: string;
}

/** The literal command each badge names; never translated. */
export const COMMAND_LABELS: Record<LearnableCommand, string> = {
  log: "git log",
  switch: "git switch",
  merge: "git merge",
  "cherry-pick": "git cherry-pick",
  revert: "git revert",
  rebase: "git rebase",
  "interactive-rebase": "git rebase -i",
};

/** The command a typed line uses, if it names one the game supports. Arguments don't matter. */
export function learnedCommandOf(line: string): LearnableCommand | undefined {
  const [first = ""] = line.trim().split(/\r?\n/);
  const tokens = first.trim().split(/\s+/).map((token) => token.toLowerCase());
  if (tokens[0] !== "git") return undefined;
  switch (tokens[1]) {
    case "log":
    case "switch":
    case "merge":
    case "cherry-pick":
    case "revert":
      return tokens[1];
    // `git checkout <branch>` is accepted as an alias of `git switch`.
    case "checkout":
      return "switch";
    case "rebase":
      return tokens.slice(2).some((token) => token === "-i" || token === "--interactive") ? "interactive-rebase" : "rebase";
    default:
      return undefined;
  }
}

/** Keeps the earliest time for each command across both sets. */
export function mergeLearned(a: LearnedCommands, b: LearnedCommands): LearnedCommands {
  const merged: LearnedCommands = { ...a };
  for (const id of LEARNABLE_COMMANDS) {
    const time = b[id];
    if (time && (!merged[id] || time < merged[id]!)) merged[id] = time;
  }
  return merged;
}

export function commandAchievements(learned: LearnedCommands): CommandAchievement[] {
  return LEARNABLE_COMMANDS.map((id) =>
    learned[id] ? { id, unlocked: true, unlockedAt: learned[id] } : { id, unlocked: false },
  );
}

/** Commands present in `next` but not in `previous`, in catalog order. */
export function newlyLearned(previous: LearnedCommands, next: LearnedCommands): LearnableCommand[] {
  return LEARNABLE_COMMANDS.filter((id) => next[id] && !previous[id]);
}
