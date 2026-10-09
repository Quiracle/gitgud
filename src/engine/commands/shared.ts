import { cloneRepository } from "../clone";
import type { Commit, CommitProvenance, Repository, SemanticChange } from "../types";

export interface MutationResult {
  repository: Repository;
  output: string[];
  mutated: boolean;
}

export function appendGeneratedCommit(
  source: Repository,
  message: string,
  parents: string[],
  changes: SemanticChange[],
  provenance: CommitProvenance,
): { repository: Repository; commit: Commit } {
  const repository = cloneRepository(source);
  let id = `g${repository.nextGeneratedId}`;

  while (Object.hasOwn(repository.commits, id)) {
    repository.nextGeneratedId += 1;
    id = `g${repository.nextGeneratedId}`;
  }

  repository.nextGeneratedId += 1;
  const commit: Commit = { id, parents, message, changes, provenance };
  repository.commits[id] = commit;
  repository.head = id;
  repository.branches[repository.currentBranch] = id;

  return { repository, commit };
}
