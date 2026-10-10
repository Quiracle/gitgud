import { applyChanges, getSnapshot, parseGitCommand, type GitAction } from "../../engine";
import { semanticEqual } from "../../engine/values";
import { CHICKEN_V2_SEMANTIC_POLICY, EMPTY_CHICKEN_STATE } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, ValidationIssue } from "../types";
import type { BriefValidationResult, GenerationBrief, GitConcept } from "./types";

export function validateCandidateAgainstBrief(
  input: unknown,
  brief: GenerationBrief,
): BriefValidationResult {
  const validated = validatePuzzleCandidate(input, {
    semantic: CHICKEN_V2_SEMANTIC_POLICY,
    difficultyPolicy: {
      easy: {}, medium: {}, hard: {},
    },
  });
  if (!validated.ok) return validated;

  const candidate = input as PuzzleCandidate;
  const issues: ValidationIssue[] = [];
  equal(candidate.schemaVersion, 2, "brief.schema-version", "Candidate must use schema version 2.", "$.schemaVersion", issues);
  equal(candidate.themeId, "chicken-v1", "brief.theme", "Candidate must use the chicken-v1 theme.", "$.themeId", issues);
  equal(candidate.kind, "daily", "brief.kind", "Candidate must be a daily puzzle.", "$.kind", issues);
  equal(candidate.difficulty, brief.difficulty, "brief.difficulty", "Candidate difficulty differs from the reserved daily difficulty.", "$.difficulty", issues);
  equal(candidate.publishedOn, brief.date, "brief.date", "Candidate date differs from the reserved UTC date.", "$.publishedOn", issues);
  equal(Object.keys(candidate.initialRepository.branches).length, brief.branchCount, "brief.branch-count", "Candidate has the wrong number of branches.", "$.initialRepository.branches", issues);
  equal(Object.keys(candidate.initialRepository.commits).length, brief.commitCount, "brief.commit-count", "Candidate has the wrong number of commits.", "$.initialRepository.commits", issues);
  equal(candidate.hints.length, brief.hintCount, "brief.hint-count", "Candidate has the wrong number of hints.", "$.hints", issues);
  if (!semanticEqual(candidate.target.snapshot, brief.targetState)) {
    add(issues, "brief.target-state", "Candidate target accessories or colors differ from the persisted brief.", "$.target.snapshot");
  }
  validateImmutableGenerationShape(candidate, brief, issues);
  validateCommitChangePreconditions(candidate, issues);
  validateGraphArchetype(candidate, brief, issues);
  if (candidate.target.branch !== "main") {
    add(issues, "brief.target-branch", "Daily puzzles must finish on main.", "$.target.branch");
  }
  if (!sameSet(candidate.allowedCommands, brief.allowedCommands)) {
    add(issues, "brief.allowed-commands", "Candidate allowed commands differ from the persisted brief.", "$.allowedCommands");
  }
  if (candidate.solutionCommands.length < brief.solutionLength.min || candidate.solutionCommands.length > brief.solutionLength.max) {
    add(issues, "brief.solution-length", "Candidate solution length is outside the brief range.", "$.solutionCommands");
  }
  const concepts = conceptsIn(candidate.solutionCommands);
  brief.requiredConcepts.forEach((concept) => {
    if (!concepts.has(concept)) add(issues, "brief.missing-concept", `Proof solution does not demonstrate '${concept}'.`, "$.solutionCommands");
  });
  if (!candidate.description.toLowerCase().includes(brief.storyTheme.toLowerCase().split(" ")[0])) {
    add(issues, "brief.story-theme", `Description must clearly reference the '${brief.storyTheme}' story theme.`, "$.description");
  }
  return { ok: issues.length === 0, issues };
}

/**
 * Generic candidate validation accepts reusable lessons. Daily generation is
 * stricter: its names and baseline are derivable from the persisted brief and
 * must never be model-selected.
 */
function validateImmutableGenerationShape(candidate: PuzzleCandidate, brief: GenerationBrief, issues: ValidationIssue[]) {
  const expectedCommitIds = Array.from({ length: brief.commitCount }, (_, index) => `c${index + 1}`);
  const expectedBranches = ["main", "feature", "style", "polish"].slice(0, brief.branchCount);
  const commitIds = Object.keys(candidate.initialRepository.commits).sort();
  const branches = Object.keys(candidate.initialRepository.branches).sort();
  if (!sameSet(commitIds, expectedCommitIds)) add(issues, "brief.commit-ids", "Daily generation must use exactly c1 through cN, each exactly once.", "$.initialRepository.commits");
  if (!sameSet(branches, expectedBranches)) add(issues, "brief.branch-set", "Daily generation must use the canonical branch names for its branch count.", "$.initialRepository.branches");
  if (candidate.initialRepository.currentBranch !== "main") add(issues, "brief.initial-branch", "Daily generation must start on main.", "$.initialRepository.currentBranch");
  if (candidate.initialRepository.head !== candidate.initialRepository.branches.main) add(issues, "brief.initial-head", "Daily generation HEAD must equal the main branch head.", "$.initialRepository.head");
  if (!semanticEqual(candidate.initialRepository.initialState, EMPTY_CHICKEN_STATE)) add(issues, "brief.initial-state", "Daily generation must use the canonical empty chicken baseline.", "$.initialRepository.initialState");
  if (candidate.initialRepository.nextGeneratedId !== 1) add(issues, "brief.generated-id-baseline", "Daily generation must begin generated IDs at g1.", "$.initialRepository.nextGeneratedId");
  if (Object.keys(candidate.target.branchHeads ?? {}).length !== 0) add(issues, "brief.target-branch-heads", "Daily generation does not permit model-defined branch-head requirements.", "$.target.branchHeads");
  if ((candidate.target.requiredProvenance ?? []).length !== 0) add(issues, "brief.target-provenance", "Daily generation does not permit model-defined provenance requirements.", "$.target.requiredProvenance");

  for (const [id, commit] of Object.entries(candidate.initialRepository.commits)) {
    const index = Number(id.slice(1));
    if (!Number.isInteger(index) || id !== `c${index}`) continue;
    for (const parent of commit.parents) {
      const parentIndex = Number(parent.slice(1));
      if (!Number.isInteger(parentIndex) || parent !== `c${parentIndex}` || parentIndex >= index) {
        add(issues, "brief.forward-parent", "A generated commit may reference only an earlier cN parent.", `$.initialRepository.commits.${id}.parents`);
      }
    }
    if (id === "c1" && commit.parents.length !== 0) add(issues, "brief.root-parent", "c1 must be the root commit with no parents.", `$.initialRepository.commits.${id}.parents`);
    if (commit.provenance?.type !== "original" || (commit.provenance.sourceCommits ?? []).length !== 0) add(issues, "brief.initial-provenance", "Initial generated commits must have empty original provenance.", `$.initialRepository.commits.${id}.provenance`);
  }
}

/** The snapshot reader deliberately tolerates historical bad data; publication may not. */
function validateCommitChangePreconditions(candidate: PuzzleCandidate, issues: ValidationIssue[]) {
  const commits = candidate.initialRepository.commits;
  for (const id of Object.keys(commits).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))) {
    const commit = commits[id];
    if (commit.parents.some((parent) => !Object.hasOwn(commits, parent))) continue;
    try {
      const parentSnapshot = commit.parents[0]
        ? getSnapshot(candidate.initialRepository, commit.parents[0])
        : candidate.initialRepository.initialState;
      applyChanges(parentSnapshot, commit.changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Commit semantic precondition failed.";
      add(issues, "repository.incorrect-change-from", message, `$.initialRepository.commits.${id}.changes`);
    }
  }
}

function validateGraphArchetype(candidate: PuzzleCandidate, brief: GenerationBrief, issues: ValidationIssue[]) {
  const repository = candidate.initialRepository;
  const mainHead = repository.branches.main;
  const otherHeads = Object.entries(repository.branches)
    .filter(([branch]) => branch !== "main")
    .map(([, head]) => head);
  const fail = (message: string) => add(issues, "brief.graph-archetype", message, "$.initialRepository");
  const actions = candidate.solutionCommands.flatMap((command) => {
    const parsed = parseGitCommand(command);
    return parsed.ok ? [parsed.action] : [];
  });

  if (!mainHead) return fail("The requested graph archetype requires a main branch.");
  switch (brief.graphArchetype) {
    case "fast-forward":
      if (!otherHeads.some((head) => isAncestor(repository, mainHead, head) && head !== mainHead)) {
        fail("Fast-forward briefs require another branch to descend from main.");
      }
      if (!actions.some((action) => action.type === "merge" && action.ffOnly && action.branch !== "main")) {
        fail("Fast-forward briefs require a --ff-only merge of a side branch in the proof.");
      }
      return;
    case "divergent-merge":
      if (!otherHeads.some((head) => !isAncestor(repository, mainHead, head) && !isAncestor(repository, head, mainHead) && shareAncestor(repository, head, mainHead))) {
        fail("Divergent-merge briefs require main and another branch to have diverged from a shared ancestor.");
      }
      if (!actions.some((action) => action.type === "merge" && !action.ffOnly && action.branch !== "main")) {
        fail("Divergent-merge briefs require a non-fast-forward side-branch merge in the proof.");
      }
      return;
    case "curate-and-undo":
      if (!brief.requiredConcepts.includes("revert") || !brief.requiredConcepts.includes("cherry-pick")) {
        fail("Curate-and-undo briefs require revert plus cherry-pick.");
      }
      const reverted = actions.filter((action): action is Extract<GitAction, { type: "revert" }> => action.type === "revert" && repository.commits[action.commit]?.parents.length === 1);
      const imported = actions.filter((action): action is Extract<GitAction, { type: "cherry-pick" }> => action.type === "cherry-pick");
      if (reverted.length === 0 || imported.length === 0) {
        fail("Curate-and-undo proofs must revert a normal commit and import useful work.");
      }
      if (reverted.some((action) => imported.some((pick) => changesOverlap(repository, action.commit, pick.commit)))) {
        fail("Curate-and-undo must keep reverted and imported accessory properties disjoint.");
      }
      return;
    case "multi-branch-curation":
      if (Object.keys(repository.branches).length < 3 || brief.requiredConcepts.length < 3) {
        fail("Multi-branch curation requires at least three branches and three proof concepts.");
      }
      const picked = actions.filter((action): action is Extract<GitAction, { type: "cherry-pick" }> => action.type === "cherry-pick").map((action) => action.commit);
      if (new Set(picked).size < 2) {
        fail("Multi-branch curation proofs must import at least two distinct commits.");
      }
      if (picked.some((id, index) => picked.slice(index + 1).some((other) => changesOverlap(repository, id, other)))) {
        fail("Multi-branch curation must assign imported commits different accessory properties.");
      }
      return;
    case "single-transfer":
      if (otherHeads.length !== 1 || otherHeads[0] === mainHead) {
        fail("Single-transfer briefs require exactly one distinct side branch.");
      }
      if (!actions.some((action) => action.type === "cherry-pick")) {
        fail("Single-transfer briefs require a literal cherry-pick proof step.");
      }
  }
}

function changesOverlap(repository: PuzzleCandidate["initialRepository"], left: string, right: string) {
  const leftProperties = new Set((repository.commits[left]?.changes ?? []).map((change) => change.property));
  return (repository.commits[right]?.changes ?? []).some((change) => leftProperties.has(change.property));
}

function isAncestor(repository: PuzzleCandidate["initialRepository"], ancestor: string, descendant: string): boolean {
  const pending = [descendant];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === ancestor) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(repository.commits[current]?.parents ?? []));
  }
  return false;
}

function shareAncestor(repository: PuzzleCandidate["initialRepository"], left: string, right: string): boolean {
  const leftAncestors = ancestors(repository, left);
  return [...ancestors(repository, right)].some((commit) => leftAncestors.has(commit));
}

function ancestors(repository: PuzzleCandidate["initialRepository"], start: string): Set<string> {
  const result = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    pending.push(...(repository.commits[current]?.parents ?? []));
  }
  return result;
}

function conceptsIn(commands: string[]): Set<GitConcept> {
  const result = new Set<GitConcept>();
  commands.forEach((command) => {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) return;
    if (parsed.action.type === "merge" && parsed.action.ffOnly) result.add("ff-only");
    else result.add(parsed.action.type as GitConcept);
  });
  return result;
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function equal(actual: unknown, expected: unknown, code: string, message: string, path: string, issues: ValidationIssue[]) {
  if (actual !== expected) add(issues, code, message, path);
}

function add(issues: ValidationIssue[], code: string, message: string, path: string) {
  issues.push({ code, message, path });
}
