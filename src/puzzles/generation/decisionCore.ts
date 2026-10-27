import { executeCommand, getSnapshot, parseGitCommand, type Repository } from "../../engine";
import type { PuzzleCandidate } from "../types";
import { fingerprintMechanics } from "./novelty";

/**
 * Conservative novelty heuristic, NOT an engine state key or certificate.
 * Compare the work touched by a proof, ignoring unused branches and independent
 * cosmetic work. Independent operation reordering yields the same core. A
 * different core is not proof of a new strategy; human evaluation still matters.
 */
export function fingerprintDecisionCore(candidate: PuzzleCandidate): string {
  const initial = candidate.initialRepository;
  const usedBranches = new Set(["main", initial.currentBranch]);
  const originalIds = new Set<string>();
  const includeHistory = (repository: Repository, start: string) => {
    const pending = [start], seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const commit = repository.commits[id];
      if (!commit) throw new Error("Proof references missing history.");
      if (initial.commits[id]) originalIds.add(id);
      pending.push(...commit.parents, ...commit.provenance?.sourceCommits ?? []);
    }
  };
  let repository = initial;
  includeHistory(repository, repository.head);
  for (const command of candidate.solutionCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) throw new Error("Invalid proof command.");
    const action = parsed.action;
    if (action.type === "switch" || action.type === "merge") {
      usedBranches.add(action.branch);
      includeHistory(repository, repository.branches[action.branch]);
    } else if (action.type === "rebase" || action.type === "interactive-rebase") {
      usedBranches.add(action.onto);
      includeHistory(repository, repository.branches[action.onto]);
    } else if (action.type === "cherry-pick" || action.type === "revert") {
      includeHistory(repository, action.commit);
    }
    const step = executeCommand(repository, command);
    if (!step.ok) throw new Error("Invalid proof transition.");
    repository = step.repository;
  }
  const start = getSnapshot(initial, initial.branches.main);
  const relevant = new Set(Object.keys(candidate.target.snapshot).filter(property => JSON.stringify(start[property]) !== JSON.stringify(candidate.target.snapshot[property])));
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of originalIds) {
      const changes = initial.commits[id].changes;
      if (!changes.some(change => relevant.has(change.property))) continue;
      for (const change of changes) if (!relevant.has(change.property)) { relevant.add(change.property); grew = true; }
    }
  }
  const commits = Object.fromEntries([...originalIds].map(id => [id, {
    ...initial.commits[id], changes: initial.commits[id].changes.filter(change => relevant.has(change.property)),
  }]));
  // Collapse single-parent commits with no relevant effects. This can merge
  // puzzles that differ in subtler history behavior, intentionally conservative.
  const resolve = (id: string): string => {
    const commit = commits[id];
    if (!commit) throw new Error("Incomplete decision core.");
    return !commit.changes.length && commit.parents.length === 1 ? resolve(commit.parents[0]) : id;
  };
  const kept = Object.fromEntries(Object.entries(commits).filter(([id]) => resolve(id) === id).map(([id, commit]) => [id, { ...commit, parents: commit.parents.map(resolve) }]));
  const branches = Object.fromEntries([...usedBranches].map(branch => [branch, resolve(initial.branches[branch])]));
  const restrict = (state: Record<string, unknown>) => Object.fromEntries(Object.entries(state).filter(([property]) => relevant.has(property)));
  return fingerprintMechanics({ ...initial, commits: kept, branches, head: resolve(initial.head), initialState: restrict(initial.initialState) },
    { branch: "main", snapshot: restrict(candidate.target.snapshot) }).canonical;
}
