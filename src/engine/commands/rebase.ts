import { cloneRepository } from "../clone";
import { GitSimulationError } from "../errors";
import { getAncestorDistances, getCommit, isAncestor } from "../graph";
import { diffSnapshots, getSnapshot } from "../snapshot";
import type {
  Commit,
  CommitProvenance,
  RebaseTodoItem,
  Repository,
  SemanticChange,
  SemanticState,
} from "../types";
import { semanticEqual } from "../values";
import { appendGeneratedCommit, type MutationResult } from "./shared";

export interface InteractiveRebaseTodoEntry extends RebaseTodoItem {
  message: string;
}

export type InteractiveRebasePlan =
  | { ok: true; onto: string; todo: InteractiveRebaseTodoEntry[] }
  | { ok: false; error: string };

/** `git rebase <branch>`: replays the current branch's own commits onto that branch. */
export function rebaseBranch(source: Repository, onto: string): MutationResult {
  const upstreamHead = resolveUpstream(source, onto);

  if (isAncestor(source, upstreamHead, source.head)) {
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false,
    };
  }

  if (isAncestor(source, source.head, upstreamHead)) {
    return fastForward(source, upstreamHead);
  }

  const commits = commitsToReplay(source, upstreamHead);
  return replay(source, upstreamHead, commits.map((commit) => [commit]));
}

/**
 * `git rebase -i <branch>`: the todo list may keep each commit (`pick`) or fold it
 * into the previous one (`squash`). Commits must stay in their listed order.
 */
export function interactiveRebase(
  source: Repository,
  onto: string,
  todo?: readonly RebaseTodoItem[],
): MutationResult {
  const upstreamHead = resolveUpstream(source, onto);
  const commits = commitsToReplay(source, upstreamHead);

  if (commits.length === 0) {
    if (source.head !== upstreamHead && isAncestor(source, source.head, upstreamHead)) {
      return fastForward(source, upstreamHead);
    }
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false,
    };
  }

  const plan = todo ?? commits.map((commit) => ({ action: "pick" as const, commit: commit.id }));
  return replay(source, upstreamHead, groupTodo(commits, plan));
}

/** The default todo list shown to the player before an interactive rebase runs. */
export function planInteractiveRebase(
  repository: Repository,
  onto: string,
): InteractiveRebasePlan {
  try {
    const commits = commitsToReplay(repository, resolveUpstream(repository, onto));
    return {
      ok: true,
      onto,
      todo: commits.map((commit) => ({
        action: "pick",
        commit: commit.id,
        message: commit.message,
      })),
    };
  } catch (error) {
    if (!(error instanceof GitSimulationError)) throw error;
    return { ok: false, error: error.message };
  }
}

function resolveUpstream(repository: Repository, onto: string): string {
  if (!Object.hasOwn(repository.branches, onto)) {
    throw new GitSimulationError(`Unknown branch: ${onto}`);
  }
  return repository.branches[onto];
}

/**
 * Commits reachable from HEAD but not from the upstream, oldest first. Merge
 * commits are dropped and their non-merge ancestors flattened, as Git does by default.
 */
function commitsToReplay(repository: Repository, upstreamHead: string): Commit[] {
  const upstream = getAncestorDistances(repository, upstreamHead);
  const ordered: Commit[] = [];
  const visited = new Set<string>();

  const visit = (id: string) => {
    if (visited.has(id) || upstream.has(id)) return;
    visited.add(id);
    const commit = getCommit(repository, id);
    if (commit.parents.length === 0) {
      throw new GitSimulationError("The branches do not share a common ancestor.");
    }
    commit.parents.forEach(visit);
    if (commit.parents.length === 1) ordered.push(commit);
  };

  visit(repository.head);
  return ordered;
}

function groupTodo(commits: Commit[], todo: readonly RebaseTodoItem[]): Commit[][] {
  const expected = commits.map((commit) => commit.id);
  const listed = todo.map((item) => item.commit);
  if (!semanticEqual(expected, listed)) {
    throw new GitSimulationError(
      `The rebase todo list must keep these commits in order: ${expected.join(", ")}.\nReordering and dropping commits are not supported in this version.`,
    );
  }
  if (todo[0]?.action !== "pick") {
    throw new GitSimulationError(
      "Cannot squash without a previous commit. The first todo entry must be pick.",
    );
  }

  const groups: Commit[][] = [];
  todo.forEach((item, index) => {
    if (item.action === "pick") groups.push([commits[index]]);
    else groups[groups.length - 1].push(commits[index]);
  });
  return groups;
}

function fastForward(source: Repository, upstreamHead: string): MutationResult {
  const repository = cloneRepository(source);
  repository.head = upstreamHead;
  repository.branches[repository.currentBranch] = upstreamHead;
  return {
    repository,
    output: [
      `Fast-forwarded ${source.currentBranch} to ${upstreamHead}.`,
      successLine(source),
    ],
    mutated: true,
  };
}

/** Rebuilds each group on top of the upstream; a conflict aborts the whole rebase. */
function replay(
  source: Repository,
  upstreamHead: string,
  groups: Commit[][],
): MutationResult {
  let repository = cloneRepository(source);
  repository.head = upstreamHead;
  repository.branches[repository.currentBranch] = upstreamHead;
  const output: string[] = [];

  for (const group of groups) {
    const [first] = group;

    // A pick whose parent is already the new tip needs no rewrite, as in Git.
    if (group.length === 1 && first.parents[0] === repository.head) {
      repository.head = first.id;
      repository.branches[repository.currentBranch] = first.id;
      continue;
    }

    const before = getSnapshot(repository);
    if (group.length === 1 && isAlreadyApplied(before, first.changes)) {
      output.push(`Dropped ${first.id}: its changes are already upstream.`);
      continue;
    }

    let after = before;
    for (const commit of group) after = applyOrConflict(after, commit);

    const squashed = group.length > 1;
    const changes = squashed ? diffSnapshots(before, after) : structuredClone(first.changes);
    const provenance: CommitProvenance = squashed
      ? { type: "squash", sourceCommits: group.map((commit) => commit.id) }
      : { type: "rebase", sourceCommits: [first.id] };
    const message = group.map((commit) => commit.message).join("; ");
    const appended = appendGeneratedCommit(
      repository,
      message,
      [repository.head],
      changes,
      provenance,
    );
    repository = appended.repository;
    output.push(
      squashed
        ? `Squashed ${group.map((commit) => commit.id).join(", ")} into ${appended.commit.id}: ${message}`
        : `Replayed ${first.id} as ${appended.commit.id}: ${message}`,
    );
  }

  if (repository.head === source.head) {
    return {
      repository: source,
      output: [`Current branch ${source.currentBranch} is up to date.`],
      mutated: false,
    };
  }

  output.push(successLine(source));
  return { repository, output, mutated: true };
}

function applyOrConflict(state: SemanticState, commit: Commit): SemanticState {
  const result = structuredClone(state);
  for (const change of commit.changes) {
    if (!semanticEqual(result[change.property], change.from)) {
      throw new GitSimulationError(
        `Merge conflict on \`${change.property}\` while replaying ${commit.id}.\n\nConflict resolution is not supported in this version.`,
      );
    }
    result[change.property] = structuredClone(change.to);
  }
  return result;
}

function isAlreadyApplied(state: SemanticState, changes: SemanticChange[]): boolean {
  return (
    changes.length > 0 &&
    changes.every((change) => semanticEqual(state[change.property], change.to))
  );
}

function successLine(source: Repository): string {
  return `Successfully rebased and updated refs/heads/${source.currentBranch}.`;
}
