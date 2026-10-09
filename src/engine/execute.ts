import { cherryPick } from "./commands/cherryPick";
import { showLog } from "./commands/log";
import { mergeBranch } from "./commands/merge";
import { revertCommit } from "./commands/revert";
import { switchBranch } from "./commands/switch";
import { GitSimulationError } from "./errors";
import { parseGitCommand } from "./parser";
import type { CommandResult, GitAction, Repository } from "./types";

export function executeCommand(
  repository: Repository,
  input: string,
): CommandResult {
  const parsed = parseGitCommand(input);
  if (!parsed.ok) {
    return {
      ok: false,
      repository,
      output: [parsed.error],
      error: parsed.error,
    };
  }

  try {
    const result = executeAction(repository, parsed.action);
    return { ok: true, action: parsed.action, ...result };
  } catch (error) {
    if (!(error instanceof GitSimulationError)) throw error;
    return {
      ok: false,
      repository,
      output: error.message.split("\n"),
      error: error.message,
    };
  }
}

function executeAction(repository: Repository, action: GitAction) {
  switch (action.type) {
    case "switch":
      return switchBranch(repository, action.branch);
    case "log":
      return showLog(repository, action.all);
    case "merge":
      return mergeBranch(repository, action.branch, action.ffOnly);
    case "cherry-pick":
      return cherryPick(repository, action.commit);
    case "revert":
      return revertCommit(repository, action.commit);
  }
}
