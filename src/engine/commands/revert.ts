import { GitSimulationError } from "../errors";
import { getCommit } from "../graph";
import { applyChanges, getSnapshot } from "../snapshot";
import type { Repository, SemanticChange } from "../types";
import { appendGeneratedCommit, type MutationResult } from "./shared";

export function revertCommit(
  source: Repository,
  commitId: string,
): MutationResult {
  const reverted = getCommit(source, commitId);
  if (reverted.parents.length > 1) {
    throw new GitSimulationError(
      "Reverting merge commits is not supported in this version.",
    );
  }

  const inverse: SemanticChange[] = [...reverted.changes]
    .reverse()
    .map((change) => ({
      type: "set",
      property: change.property,
      from: structuredClone(change.to),
      to: structuredClone(change.from),
    }));

  applyChanges(getSnapshot(source), inverse);
  const { repository, commit } = appendGeneratedCommit(
    source,
    `Revert ${commitId}: ${reverted.message}`,
    [source.head],
    inverse,
    { type: "revert", sourceCommits: [commitId] },
  );

  return {
    repository,
    output: [`[${source.currentBranch} ${commit.id}] ${commit.message}`],
    mutated: true,
  };
}
