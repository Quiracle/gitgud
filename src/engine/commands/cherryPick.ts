import { GitSimulationError } from "../errors";
import { getCommit } from "../graph";
import { applyChanges, getSnapshot } from "../snapshot";
import type { Repository } from "../types";
import { appendGeneratedCommit, type MutationResult } from "./shared";

export function cherryPick(
  source: Repository,
  commitId: string,
): MutationResult {
  const picked = getCommit(source, commitId);
  if (picked.parents.length > 1) {
    throw new GitSimulationError(
      "Cherry-picking merge commits is not supported in this version.",
    );
  }

  applyChanges(getSnapshot(source), picked.changes);
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Cherry-pick ${commitId}: ${picked.message}`,
    [source.head],
    structuredClone(picked.changes),
    { type: "cherry-pick", sourceCommits: [commitId] },
  );

  return {
    repository,
    output: [`[${source.currentBranch} ${commit.id}] ${commit.message}`],
    mutated: true,
  };
}
