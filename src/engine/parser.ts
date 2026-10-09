import type { ParseResult } from "./types";

/** Action names the currently shipped simulator can execute. */
export const SUPPORTED_ACTION_TYPES = [
  "switch",
  "log",
  "merge",
  "cherry-pick",
  "revert",
] as const;

const usage = {
  switch: "Usage: git switch <branch>",
  merge: "Usage: git merge [--ff-only] <branch>",
  cherryPick: "Usage: git cherry-pick <commit>",
  revert: "Usage: git revert <commit>",
};

export function parseGitCommand(input: string): ParseResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return { ok: false, error: "Type a Git command to continue." };
  }

  if (tokens[0] !== "git") {
    return {
      ok: false,
      error: "Only simulated Git commands are supported. Try `git log`.",
    };
  }

  const command = tokens[1];
  if (!command) {
    return {
      ok: false,
      error: "Choose a Git command, for example `git log` or `git switch main`.",
    };
  }

  switch (command) {
    case "log":
      if (tokens.length === 2) {
        return { ok: true, action: { type: "log", all: false } };
      }
      if (tokens.length === 3 && tokens[2] === "--all") {
        return { ok: true, action: { type: "log", all: true } };
      }
      return {
        ok: false,
        error: "This simulator supports `git log` and `git log --all`.",
      };

    case "switch":
    case "checkout":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.switch };
      }
      return { ok: true, action: { type: "switch", branch: tokens[2] } };

    case "merge": {
      if (tokens.length === 3 && !tokens[2].startsWith("-")) {
        return {
          ok: true,
          action: { type: "merge", branch: tokens[2], ffOnly: false },
        };
      }

      if (tokens.length === 4 && tokens[2] === "--ff-only" && !tokens[3].startsWith("-")) {
        return {
          ok: true,
          action: { type: "merge", branch: tokens[3], ffOnly: true },
        };
      }

      return { ok: false, error: usage.merge };
    }

    case "cherry-pick":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.cherryPick };
      }
      return { ok: true, action: { type: "cherry-pick", commit: tokens[2] } };

    case "revert":
      if (tokens.length !== 3 || tokens[2].startsWith("-")) {
        return { ok: false, error: usage.revert };
      }
      return { ok: true, action: { type: "revert", commit: tokens[2] } };

    case "add":
    case "commit":
    case "push":
    case "pull":
    case "fetch":
    case "stash":
    case "reset":
    case "bisect":
    case "reflog":
    case "tag":
      return {
        ok: false,
        error: `\`git ${command}\` is not part of this puzzle simulator.`,
      };

    default:
      return {
        ok: false,
        error: `Unknown Git command: ${command}. Try \`git log\` to inspect the repository.`,
      };
  }
}
