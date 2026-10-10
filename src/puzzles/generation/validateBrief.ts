import { parseGitCommand } from "../../engine";
import { semanticEqual } from "../../engine/values";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
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

function validateGraphArchetype(candidate: PuzzleCandidate, brief: GenerationBrief, issues: ValidationIssue[]) {
  const repository = candidate.initialRepository;
  const mainHead = repository.branches.main;
  const otherHeads = Object.entries(repository.branches)
    .filter(([branch]) => branch !== "main")
    .map(([, head]) => head);
  const fail = (message: string) => add(issues, "brief.graph-archetype", message, "$.initialRepository");

  if (!mainHead) return fail("The requested graph archetype requires a main branch.");
  switch (brief.graphArchetype) {
    case "fast-forward":
      if (!otherHeads.some((head) => isAncestor(repository, mainHead, head) && head !== mainHead)) {
        fail("Fast-forward briefs require another branch to descend from main.");
      }
      return;
    case "divergent-merge":
      if (!otherHeads.some((head) => !isAncestor(repository, mainHead, head) && !isAncestor(repository, head, mainHead) && shareAncestor(repository, head, mainHead))) {
        fail("Divergent-merge briefs require main and another branch to have diverged from a shared ancestor.");
      }
      return;
    case "curate-and-undo":
      if (!brief.requiredConcepts.includes("revert") || !brief.requiredConcepts.some((value) => value === "merge" || value === "cherry-pick")) {
        fail("Curate-and-undo briefs require revert plus merge or cherry-pick.");
      }
      return;
    case "multi-branch-curation":
      if (Object.keys(repository.branches).length < 3 || brief.requiredConcepts.length < 3) {
        fail("Multi-branch curation requires at least three branches and three proof concepts.");
      }
      return;
    case "single-transfer":
      if (otherHeads.length !== 1 || otherHeads[0] === mainHead) {
        fail("Single-transfer briefs require exactly one distinct side branch.");
      }
  }
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
