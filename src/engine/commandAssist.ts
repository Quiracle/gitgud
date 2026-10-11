import type { GitAction } from "./types";

export type CommandReferenceKind = "branch" | "commit";

type SupportedAction = GitAction["type"];

const commandCandidates: ReadonlyArray<{ action: SupportedAction; command: string }> = [
  { action: "switch", command: "git switch" },
  { action: "log", command: "git log" },
  { action: "merge", command: "git merge" },
  { action: "cherry-pick", command: "git cherry-pick" },
  // Rebase intentionally precedes revert: `git r` teaches the requested rebase completion.
  { action: "rebase", command: "git rebase" },
  { action: "interactive-rebase", command: "git rebase -i" },
  { action: "revert", command: "git revert" },
];

/** Returns a complete supported command while the player is typing its command name. */
export function getCommandSuggestion(
  input: string,
  allowedActions: readonly SupportedAction[],
): string | null {
  const normalized = input.trimStart().toLowerCase();
  if (!normalized || normalized === "git") return null;

  const allowed = new Set(allowedActions);
  const candidates = commandCandidates
    .filter(({ action }) => allowed.has(action))
    .map(({ command }) => command)
    .filter((command, index, commands) => commands.indexOf(command) === index);

  if (allowed.has("merge") && normalized.startsWith("git merge -")) {
    return completionFor(normalized, "git merge --ff-only");
  }
  if (allowed.has("interactive-rebase") && normalized.startsWith("git rebase -")) {
    return completionFor(normalized, "git rebase -i");
  }

  // Once a full command and its separating space are present, cards provide arguments.
  if (candidates.includes(normalized)) return null;
  if (candidates.some((candidate) => normalized === `${candidate} `)) return null;
  return candidates.map((candidate) => completionFor(normalized, candidate)).find(Boolean) ?? null;
}

/** Identifies which kind of graph reference can complete the current command. */
export function getCommandReferenceKind(
  input: string,
  allowedActions?: readonly SupportedAction[],
): CommandReferenceKind | null {
  const tokens = tokensFor(input);
  if (tokens[0] !== "git") return null;

  if (tokens[1] === "cherry-pick" || tokens[1] === "revert") {
    const action = tokens[1] as "cherry-pick" | "revert";
    return isAllowed(action, allowedActions) && tokens.length <= 3 && !tokens[2]?.startsWith("-")
      ? "commit"
      : null;
  }

  if (tokens[1] === "switch" || tokens[1] === "checkout") {
    return isAllowed("switch", allowedActions) && tokens.length <= 3 && !tokens[2]?.startsWith("-")
      ? "branch"
      : null;
  }

  if (tokens[1] === "merge") {
    if (!isAllowed("merge", allowedActions)) return null;
    if (tokens[2] === "--ff-only") {
      return tokens.length <= 4 && !tokens[3]?.startsWith("-") ? "branch" : null;
    }
    return tokens.length <= 3 && !tokens[2]?.startsWith("-") ? "branch" : null;
  }

  if (tokens[1] === "rebase") {
    if (tokens[2] === "-i" || tokens[2] === "--interactive") {
      return isAllowed("interactive-rebase", allowedActions) && tokens.length <= 4 && !tokens[3]?.startsWith("-")
        ? "branch"
        : null;
    }
    return isAllowed("rebase", allowedActions) && tokens.length <= 3 && !tokens[2]?.startsWith("-")
      ? "branch"
      : null;
  }

  return null;
}

/** Prefer another branch when several names point at the selected commit. */
export function pickBranchReference(
  branches: readonly string[],
  currentBranch: string,
): string | null {
  return branches.find((branch) => branch !== currentBranch) ?? branches[0] ?? null;
}

/** Replaces the current argument with the reference represented by a selected card. */
export function fillCommandFromCard(
  input: string,
  card: { commitId: string; branches: readonly string[] },
  currentBranch: string,
  allowedActions?: readonly SupportedAction[],
): string | null {
  const kind = getCommandReferenceKind(input, allowedActions);
  if (!kind) return null;
  const reference = kind === "commit"
    ? card.commitId
    : pickBranchReference(card.branches, currentBranch);
  if (!reference) return null;

  const tokens = input.trim().split(/\s+/);
  const argumentIndex = argumentIndexFor(tokens.map((token) => token.toLowerCase()));
  if (argumentIndex === null) return null;
  return [...tokens.slice(0, argumentIndex), reference].join(" ");
}

function completionFor(input: string, candidate: string): string | null {
  return candidate !== input && candidate.startsWith(input) ? candidate : null;
}

function isAllowed(
  action: SupportedAction,
  allowedActions: readonly SupportedAction[] | undefined,
): boolean {
  return !allowedActions || allowedActions.includes(action);
}

function tokensFor(input: string): string[] {
  const trimmed = input.trim();
  return trimmed ? trimmed.split(/\s+/).map((token) => token.toLowerCase()) : [];
}

function argumentIndexFor(tokens: readonly string[]): number | null {
  if (tokens[1] === "merge" && tokens[2] === "--ff-only") return 3;
  if (tokens[1] === "rebase" && (tokens[2] === "-i" || tokens[2] === "--interactive")) return 3;
  if (["switch", "checkout", "merge", "rebase", "cherry-pick", "revert"].includes(tokens[1])) return 2;
  return null;
}
