export type CommandReferenceKind = "branch" | "commit";

const commandCandidates = [
  "git switch",
  "git log",
  "git merge",
  "git cherry-pick",
  // Rebase intentionally precedes revert: `git r` teaches the requested rebase completion.
  "git rebase",
  "git revert",
] as const;

/** Returns a complete supported command while the player is typing its command name. */
export function getCommandSuggestion(input: string): string | null {
  const normalized = input.trimStart().toLowerCase();
  if (!normalized || normalized.trimEnd() === "git") return null;

  if (normalized.startsWith("git merge -")) {
    return completionFor(normalized, "git merge --ff-only");
  }
  if (normalized.startsWith("git rebase -")) {
    return completionFor(normalized, "git rebase -i");
  }

  // Once a full command and its separating space are present, cards provide arguments.
  if (commandCandidates.some((candidate) => candidate === normalized)) return null;
  if (commandCandidates.some((candidate) => normalized === `${candidate} `)) return null;
  const matches = commandCandidates.filter((candidate) => candidate.startsWith(normalized));
  return matches.length === 1 ? matches[0] : null;
}

/** Identifies which kind of graph reference can complete the current command. */
export function getCommandReferenceKind(input: string): CommandReferenceKind | null {
  const tokens = tokensFor(input);
  if (tokens[0] !== "git") return null;

  if (tokens[1] === "cherry-pick" || tokens[1] === "revert") {
    return tokens.length <= 3 && !tokens[2]?.startsWith("-") ? "commit" : null;
  }

  if (tokens[1] === "switch" || tokens[1] === "checkout") {
    return tokens.length <= 3 && !tokens[2]?.startsWith("-") ? "branch" : null;
  }

  if (tokens[1] === "merge") {
    if (tokens[2] === "--ff-only") {
      return tokens.length <= 4 && !tokens[3]?.startsWith("-") ? "branch" : null;
    }
    return tokens.length <= 3 && !tokens[2]?.startsWith("-") ? "branch" : null;
  }

  if (tokens[1] === "rebase") {
    if (tokens[2] === "-i" || tokens[2] === "--interactive") {
      return tokens.length <= 4 && !tokens[3]?.startsWith("-") ? "branch" : null;
    }
    return tokens.length <= 3 && !tokens[2]?.startsWith("-") ? "branch" : null;
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
): string | null {
  const kind = getCommandReferenceKind(input);
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
