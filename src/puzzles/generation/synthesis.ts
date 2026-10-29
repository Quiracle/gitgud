import { executeCommand, getSnapshot, planInteractiveRebase, type PuzzleTarget, type Repository, type SemanticChange } from "../../engine";
import { isAncestor } from "../../engine/graph";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, PuzzleDifficulty } from "../types";
import { createConstructiveProblem } from "./constructiveGraph";
import { createTemplateLocalizations } from "./editorial";
import { repositorySearchKey } from "./quality";
import { snapshotKey } from "./mechanicsState";

export interface DiscoveryLimits {
  maxCommands: number;
  beamWidth?: number;
  maxTransitions?: number;
  maxElapsedMs?: number;
}

/** Heuristic proof discovery ONLY. Failure is inconclusive; success still needs certification. */
export function discoverProof(repository: Repository, target: PuzzleTarget, limits: DiscoveryLimits) {
  const width = limits.beamWidth ?? 40;
  const maxTransitions = limits.maxTransitions ?? 30_000;
  const deadline = Date.now() + (limits.maxElapsedMs ?? 10_000);
  if (![width, maxTransitions, limits.maxCommands].every(n => Number.isInteger(n) && n > 0)) throw new Error("Invalid discovery limits.");
  let transitions = 0;
  const goal = snapshotKey(target.snapshot);
  interface Node { repository: Repository; path: string[]; rank: number }
  const queues: Node[][] = Array.from({ length: limits.maxCommands + 1 }, () => []);
  const seen = new Map<string, number>();
  const score = (repo: Repository, path: string[]) => {
    const state = getSnapshot(repo, repo.branches.main);
    return Object.keys(target.snapshot).reduce((total, key) => total + (state[key] === target.snapshot[key] ? 0 : state[key] === repository.initialState[key] ? 20 : 26), 0)
      + path.filter(command => command.startsWith("git cherry-pick")).length / 100;
  };
  const push = (repo: Repository, path: string[]) => {
    if (path.length > limits.maxCommands) return;
    const key = repositorySearchKey(repo);
    if ((seen.get(key) ?? Infinity) <= path.length) return;
    seen.set(key, path.length);
    queues[path.length].push({ repository: repo, path, rank: score(repo, path) });
  };
  push(repository, []);
  const apply = (repo: Repository, command: string) => {
    if (transitions >= maxTransitions || Date.now() >= deadline) return;
    transitions++;
    const step = executeCommand(repo, command);
    return step.ok && step.mutated ? step.repository : undefined;
  };
  for (let cost = 0; cost <= limits.maxCommands; cost++) {
    const nodes = queues[cost].sort((a, b) => a.rank - b.rank || a.path.join("\n").localeCompare(b.path.join("\n"))).slice(0, width);
    queues[cost] = [];
    for (const node of nodes) {
      if (snapshotKey(getSnapshot(node.repository, node.repository.branches.main)) === goal && node.repository.currentBranch === "main") {
        return { commands: node.path, transitions, status: "found" as const };
      }
      if (transitions >= maxTransitions || Date.now() >= deadline) return { transitions, status: "budget-exhausted" as const };
      if (cost >= limits.maxCommands) continue;
      const repo = node.repository;
      const snapshot = getSnapshot(repo);
      const before = snapshotKey(snapshot);
      const commands = Object.keys(repo.branches).filter(branch => branch !== "main").flatMap(branch => [`git merge ${branch}`, `git rebase ${branch}`]);
      commands.push(...squashPlans(repo));
      for (const commit of Object.values(repo.commits)) {
        if (commit.parents.length !== 1 || !commit.changes.length) continue;
        if (applicable(snapshot, commit.changes)) commands.push(`git cherry-pick ${commit.id}`);
        if (applicable(snapshot, inverse(commit.changes)) && isAncestor(repo, commit.id, repo.head)) commands.push(`git revert ${commit.id}`);
      }
      for (const command of commands) {
        const previous = node.path.at(-1);
        if (previous?.startsWith("git cherry-pick ") && command.startsWith("git cherry-pick ") &&
            isAncestor(repo, previous.slice(16), command.slice(16))) continue;
        const next = apply(repo, command);
        if (next && snapshotKey(getSnapshot(next)) !== before) push(next, [...node.path, command]);
      }
      if (cost + 4 > limits.maxCommands) continue;
      // Explore useful compound moves without losing their four-command cost.
      // These are search expansions, not requirements imposed on player solutions.
      for (const branch of Object.keys(repo.branches).filter(name => name !== "main")) {
        const switched = apply(repo, `git switch ${branch}`);
        if (!switched) continue;
        const branchSnapshot = getSnapshot(switched);
        const prefix = [...node.path, `git switch ${branch}`];
        for (const commit of Object.values(switched.commits)) {
          if (commit.parents.length !== 1 || !commit.changes.length || !applicable(branchSnapshot, inverse(commit.changes)) || !isAncestor(switched, commit.id, switched.head)) continue;
          const cleaned = apply(switched, `git revert ${commit.id}`);
          if (!cleaned) continue;
          const back = apply(cleaned, "git switch main");
          const merged = back && apply(back, `git merge ${branch}`);
          if (merged) push(merged, [...prefix, `git revert ${commit.id}`, "git switch main", `git merge ${branch}`]);
        }
        for (const command of squashPlans(switched)) {
          const squashed = apply(switched, command);
          if (!squashed) continue;
          const back = apply(squashed, "git switch main");
          if (!back) continue;
          for (const commit of Object.values(squashed.commits)) {
            if (repo.commits[commit.id] || !commit.changes.length || !isAncestor(squashed, commit.id, squashed.head)) continue;
            const picked = apply(back, `git cherry-pick ${commit.id}`);
            if (picked) push(picked, [...prefix, command, "git switch main", `git cherry-pick ${commit.id}`]);
          }
        }
      }
    }
  }
  if (transitions >= maxTransitions || Date.now() >= deadline) return { transitions, status: "budget-exhausted" as const };
  return { transitions, status: "not-found" as const };
}

function inverse(changes: readonly SemanticChange[]): SemanticChange[] {
  return [...changes].reverse().map(change => ({ ...change, from: change.to, to: change.from }));
}
function applicable(snapshot: Record<string, unknown>, changes: readonly SemanticChange[]): boolean {
  const current = { ...snapshot };
  for (const change of changes) {
    if (JSON.stringify(current[change.property]) !== JSON.stringify(change.from)) return false;
    current[change.property] = change.to;
  }
  return true;
}

/** A bounded subset of partitions suffices for discovery, never for certification. */
function squashPlans(repository: Repository): string[] {
  const commands: string[] = [];
  for (const branch of Object.keys(repository.branches)) {
    const plan = planInteractiveRebase(repository, branch);
    if (!plan.ok || plan.todo.length < 2) continue;
    for (let start = 0; start < plan.todo.length - 1; start++) for (let end = start + 1; end < plan.todo.length; end++) {
      const command = `git rebase -i ${branch}\n${plan.todo.map((item, index) => `${index > start && index <= end ? "squash" : "pick"} ${item.commit}`).join("\n")}`;
      if (command.length <= 160) commands.push(command);
    }
  }
  return commands.slice(0, 48);
}

export function synthesizeDailyCandidate(date: string, difficulty: PuzzleDifficulty, seed: string, limits?: Partial<DiscoveryLimits>) {
  const problem = createConstructiveProblem(seed, difficulty);
  const discovery = discoverProof(problem.repository, problem.target, { maxCommands: { easy: 2, medium: 4, hard: 10 }[difficulty], ...limits });
  if (!discovery.commands) return { discovery };
  if (discovery.commands.length < { easy: 2, medium: 4, hard: 6 }[difficulty]) return { discovery, rejection: "too-short" as const };
  const candidate: PuzzleCandidate = {
    schemaVersion: 2, themeId: "chicken-v1", id: `daily-${date}`, slug: `daily-${date}`, version: 1, kind: "daily", difficulty, publishedOn: date,
    title: "Repository Workshop", description: "Make main match the illustrated target.", objectives: ["Make main match the illustrated target."],
    hints: ["Compare the branches with the target."], initialRepository: problem.repository, target: problem.target,
    allowedCommands: ["log", "switch", "merge", "cherry-pick", "revert", "rebase", "interactive-rebase"], solutionCommands: discovery.commands,
  };
  const localizations = createTemplateLocalizations(candidate, "procedural", seed);
  const { commitMessages, ...text } = localizations.en;
  const localized: PuzzleCandidate = { ...candidate, ...text, localizations,
    initialRepository: { ...problem.repository, commits: Object.fromEntries(Object.entries(problem.repository.commits).map(([id, commit]) => [id, { ...commit, message: commitMessages[id] }])) },
  };
  const validation = validatePuzzleCandidate(localized, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok) throw new Error(`Synthesized candidate failed normal validation: ${validation.issues.map(issue => issue.code).join(", ")}`);
  return { candidate: localized, discovery };
}
