import type { ParseResult, RebaseTodoItem } from "./types";

/** Action names the currently shipped simulator can execute. */
export const SUPPORTED_ACTION_TYPES = [
  "switch",
  "log",
  "merge",
  "cherry-pick",
  "revert",
  "rebase",
  "interactive-rebase",
] as const;

const usage = {
  switch: "Usage: git switch <branch>",
  merge: "Usage: git merge [--ff-only] <branch>",
  cherryPick: "Usage: git cherry-pick <commit>",
  revert: "Usage: git revert <commit>",
  rebase: "Usage: git rebase <branch> or git rebase -i <branch>",
};

/**
 * Parses one command line. An interactive rebase may be followed by todo lines
 * (`pick <commit>` or `squash <commit>`), which is how the editor result is
 * recorded in transcripts and hidden solutions.
 */
export function parseGitCommand(input: string): ParseResult {
  const [commandLine = "", ...todoLines] = input.trim().split(/\r?\n/);
  const tokens = commandLine.trim().split(/\s+/).filter(Boolean);
  const todoSource = todoLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (todoSource.length > 0 && !(tokens[1] === "rebase" && isInteractiveFlag(tokens[2]))) {
    return { ok: false, error: "Enter one Git command at a time." };
  }

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

    case "rebase": {
      if (tokens.length === 3 && !tokens[2].startsWith("-")) {
        return { ok: true, action: { type: "rebase", onto: tokens[2] } };
      }

      if (tokens.length === 4 && isInteractiveFlag(tokens[2]) && !tokens[3].startsWith("-")) {
        if (todoSource.length === 0) {
          return { ok: true, action: { type: "interactive-rebase", onto: tokens[3] } };
        }
        const todo = parseRebaseTodo(todoSource);
        if (!todo.ok) return todo;
        return {
          ok: true,
          action: { type: "interactive-rebase", onto: tokens[3], todo: todo.todo },
        };
      }

      if (tokens[2] === "--continue" || tokens[2] === "--abort" || tokens[2] === "--skip") {
        return {
          ok: false,
          error: "Rebases never stop for conflicts in this simulator, so there is nothing to continue or abort.",
        };
      }

      return { ok: false, error: usage.rebase };
    }

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

/** Builds the transcript form of an interactive rebase whose todo list was edited. */
export function formatInteractiveRebaseCommand(
  onto: string,
  todo: readonly RebaseTodoItem[],
): string {
  return [
    `git rebase -i ${onto}`,
    ...todo.map((item) => `${item.action} ${item.commit}`),
  ].join("\n");
}

function isInteractiveFlag(token: string | undefined): boolean {
  return token === "-i" || token === "--interactive";
}

function parseRebaseTodo(
  lines: string[],
): { ok: true; todo: RebaseTodoItem[] } | { ok: false; error: string } {
  const todo: RebaseTodoItem[] = [];

  for (const line of lines) {
    const [verb, commit] = line.split(/\s+/);
    const action =
      verb === "pick" || verb === "p"
        ? "pick"
        : verb === "squash" || verb === "s"
          ? "squash"
          : undefined;

    if (!action) {
      return {
        ok: false,
        error: `Unsupported rebase todo command: ${verb}. Only pick and squash are available.`,
      };
    }
    if (!commit) {
      return { ok: false, error: `Missing commit after \`${verb}\` in the rebase todo list.` };
    }
    todo.push({ action, commit });
  }

  return { ok: true, todo };
}
