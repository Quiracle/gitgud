import {
  cloneRepository,
  executeCommand,
  applyChanges,
  getSnapshot,
  parseGitCommand,
  type Commit,
  type GitAction,
  type Repository,
  type SemanticChange,
} from "../engine";
import { semanticEqual } from "../engine/values";
import {
  BRANCH_NAME_PATTERN,
  COMMIT_ID_PATTERN,
  DEFAULT_DIFFICULTY_POLICY,
  DEFAULT_PUZZLE_LIMITS,
  PUZZLE_ID_PATTERN,
  type DifficultyConstraint,
  type PuzzleLimits,
  type PuzzleValidationConfig,
  type SemanticPolicy,
} from "./policy";
import { parsePuzzleCandidate } from "./schema";
import { validatePuzzleCompletion } from "./completion";
import type {
  JsonValue,
  PuzzleCandidate,
  PuzzleValidationResult,
  SupportedCommand,
  ValidationIssue,
} from "./types";

/**
 * Parses and validates data originating from a static file, database, or model response.
 * The success value separates the player-safe definition from the private transcript.
 */
export function validatePuzzleCandidate(
  input: unknown,
  config: PuzzleValidationConfig,
): PuzzleValidationResult {
  const parsed = parsePuzzleCandidate(input);
  if (!parsed.candidate) return { ok: false, issues: parsed.issues };

  const candidate = parsed.candidate;
  const issues = [...parsed.issues];
  const limits = { ...DEFAULT_PUZZLE_LIMITS, ...config.limits };

  validateIdentity(candidate, limits, issues);
  validateText(candidate, limits, issues);
  validateRepositoryStructure(candidate.initialRepository, limits, issues);
  validateSemanticState(candidate, config.semantic, limits, issues);
  validateTarget(candidate, config.semantic, limits, issues);
  validateAllowedCommands(candidate, issues);
  validateActionRequirements(candidate, limits, issues);
  validateDifficulty(candidate, limits, config.difficultyPolicy ?? DEFAULT_DIFFICULTY_POLICY, issues);

  if (issues.length > 0) return { ok: false, issues };

  // getSnapshot intentionally replays stored history permissively so the UI can
  // render old puzzles. Publication is stricter: every historical change must
  // be applicable to its first-parent snapshot, including merge commits.
  validateHistoricalChangePreconditions(candidate.initialRepository, issues);
  if (issues.length > 0) return { ok: false, issues };

  // Structural validation above makes the established engine safe to use as the sole source
  // of Git behavior and victory rules.
  const initialValidation = validatePuzzleCompletion(
    candidate.initialRepository,
    candidate.target,
    [],
    candidate.actionRequirements,
  );
  if (initialValidation.solved) {
    add(issues, "target.initially-solved", "The initial repository already satisfies the target.", "$.initialRepository");
  } else {
    replaySolution(candidate, issues);
  }

  if (issues.length > 0) return { ok: false, issues };

  const { solutionCommands, ...puzzle } = candidate;
  return {
    ok: true,
    value: {
      puzzle,
      privateMetadata: { solutionCommands: [...solutionCommands] },
    },
  };
}

function validateHistoricalChangePreconditions(repository: Repository, issues: ValidationIssue[]) {
  for (const [id, commit] of Object.entries(repository.commits)) {
    try {
      const baseline = commit.parents[0]
        ? getSnapshot(repository, commit.parents[0])
        : repository.initialState;
      applyChanges(baseline, commit.changes);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Commit changes do not apply to its first parent.";
      add(issues, "repository.incorrect-change-from", message, `$.initialRepository.commits.${id}.changes`);
    }
  }
}

function validateIdentity(candidate: PuzzleCandidate, limits: PuzzleLimits, issues: ValidationIssue[]) {
  if (!PUZZLE_ID_PATTERN.test(candidate.id) || candidate.id.length > limits.maxPuzzleIdLength) {
    add(issues, "identity.invalid-puzzle-id", "Puzzle IDs must be lowercase kebab-case within the configured length limit.", "$.id");
  }
  if (!PUZZLE_ID_PATTERN.test(candidate.slug) || candidate.slug.length > limits.maxSlugLength) {
    add(issues, "identity.invalid-slug", "Slugs must be lowercase kebab-case within the configured length limit.", "$.slug");
  }
  if (candidate.version < 1) {
    add(issues, "identity.invalid-version", "Puzzle version must be a positive integer.", "$.version");
  }
  if (candidate.initialRepository.nextGeneratedId < 1) {
    add(issues, "repository.invalid-generated-id", "nextGeneratedId must be a positive integer.", "$.initialRepository.nextGeneratedId");
  }
}

function validateText(candidate: PuzzleCandidate, limits: PuzzleLimits, issues: ValidationIssue[]) {
  text(candidate.title, limits.maxTitleLength, "$.title", issues);
  text(candidate.description, limits.maxDescriptionLength, "$.description", issues);
  boundedStrings(candidate.hints, limits.maxHints, limits.maxHintLength, "$.hints", issues, "content.hints-too-large");
  boundedStrings(candidate.objectives ?? [], limits.maxObjectives, limits.maxObjectiveLength, "$.objectives", issues, "content.objectives-too-large");
  boundedStrings(candidate.solutionCommands, limits.maxSolutionCommands, limits.maxSolutionCommandLength, "$.solutionCommands", issues, "content.solution-too-large");
}

function validateRepositoryStructure(repository: Repository, limits: PuzzleLimits, issues: ValidationIssue[]) {
  const commits = Object.entries(repository.commits);
  const branches = Object.entries(repository.branches);
  if (commits.length === 0) add(issues, "repository.empty-graph", "A puzzle repository requires at least one commit.", "$.initialRepository.commits");
  if (commits.length > limits.maxCommits) add(issues, "limits.commits", `Repository contains more than ${limits.maxCommits} commits.`, "$.initialRepository.commits");
  if (branches.length === 0) add(issues, "repository.empty-branches", "A puzzle repository requires at least one branch.", "$.initialRepository.branches");
  if (branches.length > limits.maxBranches) add(issues, "limits.branches", `Repository contains more than ${limits.maxBranches} branches.`, "$.initialRepository.branches");

  let changeCount = 0;
  for (const [id, commit] of commits) {
    const path = `$.initialRepository.commits.${id}`;
    if (!validCommitId(id, limits) || !validCommitId(commit.id, limits)) {
      add(issues, "repository.invalid-commit-id", "Commit IDs must start with a letter and use only letters, numbers, underscores, or hyphens within the configured length limit.", `${path}.id`);
    }
    if (commit.id !== id) add(issues, "repository.commit-id-mismatch", "The commit object's id must match its map key.", `${path}.id`);
    text(commit.message, limits.maxCommitMessageLength, `${path}.message`, issues);
    if (commit.parents.length > limits.maxParentsPerCommit) add(issues, "limits.parents-per-commit", `A commit may contain at most ${limits.maxParentsPerCommit} parents.`, `${path}.parents`);
    if (commit.changes.length > limits.maxChangesPerCommit) add(issues, "limits.changes-per-commit", `A commit may contain at most ${limits.maxChangesPerCommit} changes.`, `${path}.changes`);
    changeCount += commit.changes.length;
    for (const [parentIndex, parent] of commit.parents.entries()) {
      if (!Object.hasOwn(repository.commits, parent)) add(issues, "repository.missing-parent", `Parent commit '${parent}' does not exist.`, `${path}.parents[${parentIndex}]`);
    }
  }
  if (changeCount > limits.maxTotalChanges) add(issues, "limits.total-changes", `Repository contains more than ${limits.maxTotalChanges} semantic changes.`, "$.initialRepository.commits");

  for (const [branch, head] of branches) {
    if (!validBranchName(branch, limits)) add(issues, "repository.invalid-branch-name", "Branch names must start with a letter and use only letters, numbers, dots, underscores, hyphens, or slashes within the configured length limit.", `$.initialRepository.branches.${branch}`);
    if (!Object.hasOwn(repository.commits, head)) add(issues, "repository.missing-branch-head", `Branch '${branch}' points to unknown commit '${head}'.`, `$.initialRepository.branches.${branch}`);
  }
  if (!Object.hasOwn(repository.branches, repository.currentBranch)) add(issues, "repository.missing-current-branch", "currentBranch must name an existing branch.", "$.initialRepository.currentBranch");
  if (!Object.hasOwn(repository.commits, repository.head)) add(issues, "repository.missing-head", "head must reference an existing commit.", "$.initialRepository.head");
  if (!Object.hasOwn(repository.branches, repository.currentBranch) || repository.branches[repository.currentBranch] !== repository.head) add(issues, "repository.head-mismatch", "head must equal the current branch head.", "$.initialRepository.head");
  if (!hasParentReferenceIssues(repository, issues) && hasCycle(repository)) add(issues, "repository.cyclic-graph", "The commit graph must be acyclic.", "$.initialRepository.commits");
}

function validateSemanticState(candidate: PuzzleCandidate, policy: SemanticPolicy, limits: PuzzleLimits, issues: ValidationIssue[]) {
  validateSnapshot(candidate.initialRepository.initialState, policy, limits, "$.initialRepository.initialState", issues);
  for (const [id, commit] of Object.entries(candidate.initialRepository.commits)) {
    commit.changes.forEach((change, index) => validateChange(change, policy, limits, `$.initialRepository.commits.${id}.changes[${index}]`, issues));
    validateProvenance(commit, candidate.initialRepository, limits, `$.initialRepository.commits.${id}.provenance`, issues);
  }
}

function validateTarget(candidate: PuzzleCandidate, policy: SemanticPolicy, limits: PuzzleLimits, issues: ValidationIssue[]) {
  const { target, initialRepository: repository } = candidate;
  if (!validBranchName(target.branch, limits)) add(issues, "target.invalid-branch", "The required target branch name is invalid.", "$.target.branch");
  if (!Object.hasOwn(repository.branches, target.branch)) add(issues, "target.missing-branch", `The required target branch '${target.branch}' does not exist.`, "$.target.branch");
  validateSnapshot(target.snapshot, policy, limits, "$.target.snapshot", issues);
  if (Object.keys(target.branchHeads ?? {}).length > limits.maxTargetBranchHeads) add(issues, "limits.target-branch-heads", `At most ${limits.maxTargetBranchHeads} target branch-head invariants are allowed.`, "$.target.branchHeads");
  for (const [branch, commit] of Object.entries(target.branchHeads ?? {})) {
    if (!validBranchName(branch, limits)) add(issues, "target.invalid-branch", "A target branch invariant has an invalid branch name.", `$.target.branchHeads.${branch}`);
    if (!Object.hasOwn(repository.branches, branch)) add(issues, "target.missing-invariant-branch", `Target invariant references unknown branch '${branch}'.`, `$.target.branchHeads.${branch}`);
    if (!Object.hasOwn(repository.commits, commit)) add(issues, "target.missing-invariant-commit", `Target invariant references unknown commit '${commit}'.`, `$.target.branchHeads.${branch}`);
  }
  if ((target.requiredProvenance ?? []).length > limits.maxRequiredProvenance) add(issues, "limits.required-provenance", `At most ${limits.maxRequiredProvenance} history requirements are allowed.`, "$.target.requiredProvenance");
  (target.requiredProvenance ?? []).forEach((requirement, index) => {
    if (!Object.hasOwn(repository.commits, requirement.sourceCommit)) add(issues, "target.missing-provenance-source", `History requirement references unknown commit '${requirement.sourceCommit}'.`, `$.target.requiredProvenance[${index}].sourceCommit`);
  });
}

function validateChange(change: SemanticChange, policy: SemanticPolicy, limits: PuzzleLimits, path: string, issues: ValidationIssue[]) {
  if (change.type !== "set") add(issues, "semantic.unsupported-operation", `Semantic operation '${change.type}' is not supported.`, `${path}.type`);
  if (!Object.hasOwn(policy.properties, change.property)) add(issues, "semantic.disallowed-property", `Property '${change.property}' is not allowed by this puzzle policy.`, `${path}.property`);
  validateValue(change.from, change.property, policy, limits, `${path}.from`, issues);
  validateValue(change.to, change.property, policy, limits, `${path}.to`, issues);
}

function validateSnapshot(snapshot: Record<string, unknown>, policy: SemanticPolicy, limits: PuzzleLimits, path: string, issues: ValidationIssue[]) {
  const required = policy.requiredProperties ?? Object.keys(policy.properties);
  for (const property of Object.keys(snapshot)) {
    if (!Object.hasOwn(policy.properties, property)) add(issues, "semantic.disallowed-property", `Property '${property}' is not allowed by this puzzle policy.`, `${path}.${property}`);
    validateValue(snapshot[property], property, policy, limits, `${path}.${property}`, issues);
  }
  for (const property of required) {
    if (!Object.hasOwn(snapshot, property)) add(issues, "semantic.incomplete-state", `The complete semantic state must include '${property}'.`, path);
  }
}

function validateValue(value: unknown, property: string, policy: SemanticPolicy, limits: PuzzleLimits, path: string, issues: ValidationIssue[]) {
  if (!isJson(value, limits.maxSemanticValueDepth)) {
    add(issues, "semantic.non-json-value", "Semantic values must be finite JSON-serializable values within the configured depth limit.", path);
    return;
  }
  const allowed = policy.properties[property];
  if (allowed && !allowed.some((candidate) => semanticEqual(candidate, value))) add(issues, "semantic.disallowed-value", `Value is not allowed for semantic property '${property}'.`, path);
}

function validateProvenance(commit: Commit, repository: Repository, limits: PuzzleLimits, path: string, issues: ValidationIssue[]) {
  if (!commit.provenance) return;
  if ((commit.provenance.sourceCommits ?? []).length > limits.maxProvenanceSourcesPerCommit) add(issues, "limits.provenance-sources-per-commit", `A commit may list at most ${limits.maxProvenanceSourcesPerCommit} provenance sources.`, `${path}.sourceCommits`);
  for (const [index, source] of (commit.provenance.sourceCommits ?? []).entries()) {
    if (!Object.hasOwn(repository.commits, source)) add(issues, "repository.missing-provenance-source", `Provenance references unknown commit '${source}'.`, `${path}.sourceCommits[${index}]`);
  }
}

function validateAllowedCommands(candidate: PuzzleCandidate, issues: ValidationIssue[]) {
  const unique = new Set(candidate.allowedCommands);
  if (unique.size !== candidate.allowedCommands.length) add(issues, "commands.duplicate-allowed-command", "allowedCommands must not contain duplicates.", "$.allowedCommands");
  if (candidate.allowedCommands.length === 0) add(issues, "commands.empty-allowed-commands", "A puzzle must allow at least one supported command.", "$.allowedCommands");
}

function validateActionRequirements(candidate: PuzzleCandidate, limits: PuzzleLimits, issues: ValidationIssue[]) {
  if ((candidate.actionRequirements ?? []).length > limits.maxRequiredActions) {
    add(issues, "limits.required-actions", `At most ${limits.maxRequiredActions} action requirements are allowed.`, "$.actionRequirements");
  }
}

function validateDifficulty(candidate: PuzzleCandidate, limits: PuzzleLimits, policy: Record<string, DifficultyConstraint>, issues: ValidationIssue[]) {
  const constraint = policy[candidate.difficulty];
  if (!constraint) {
    add(issues, "difficulty.missing-policy", `No difficulty policy exists for '${candidate.difficulty}'.`, "$.difficulty");
    return;
  }
  const metrics = [
    ["commits", Object.keys(candidate.initialRepository.commits).length, constraint.minCommits, constraint.maxCommits, "$.initialRepository.commits"],
    ["branches", Object.keys(candidate.initialRepository.branches).length, constraint.minBranches, constraint.maxBranches, "$.initialRepository.branches"],
    ["solution commands", candidate.solutionCommands.length, constraint.minSolutionCommands, Math.min(constraint.maxSolutionCommands ?? limits.maxSolutionCommands, limits.maxSolutionCommands), "$.solutionCommands"],
    ["hints", candidate.hints.length, constraint.minHints, constraint.maxHints, "$.hints"],
  ] as const;
  metrics.forEach(([label, value, min, max, path]) => {
    if (min !== undefined && value < min) add(issues, "difficulty.below-minimum", `${candidate.difficulty} puzzles require at least ${min} ${label}.`, path);
    if (max !== undefined && value > max) add(issues, "difficulty.above-maximum", `${candidate.difficulty} puzzles allow at most ${max} ${label}.`, path);
  });
}

function replaySolution(candidate: PuzzleCandidate, issues: ValidationIssue[]) {
  let repository = cloneRepository(candidate.initialRepository);
  const actions: GitAction[] = [];
  candidate.solutionCommands.forEach((command, index) => {
    const path = `$.solutionCommands[${index}]`;
    const parsed = parseGitCommand(command);
    if (!parsed.ok) {
      add(issues, "solution.parse-failed", parsed.error, path);
      return;
    }
    if (!candidate.allowedCommands.includes(parsed.action.type as SupportedCommand)) {
      add(issues, "solution.disallowed-command", `Solution command uses '${parsed.action.type}', which is not allowed by this puzzle.`, path);
      return;
    }
    const result = executeCommand(repository, command);
    if (!result.ok) {
      const code = result.error.includes("Semantic conflict") || result.error.includes("Merge conflict") ? "solution.conflict" : "solution.execution-failed";
      add(issues, code, result.error, path);
      return;
    }
    repository = result.repository;
    actions.push(result.action);
  });
  if (issues.some((item) => item.path.startsWith("$.solutionCommands"))) return;
  const validation = validatePuzzleCompletion(
    repository,
    candidate.target,
    actions,
    candidate.actionRequirements,
  );
  if (!validation.solved) add(issues, "solution.target-not-met", validation.unmet.join(" "), "$.solutionCommands");
}

function hasParentReferenceIssues(repository: Repository, issues: ValidationIssue[]) {
  return issues.some((issue) => issue.code === "repository.missing-parent" && issue.path.startsWith("$.initialRepository"));
}

function hasCycle(repository: Repository): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    if (!Object.hasOwn(repository.commits, id)) return false;
    visiting.add(id);
    const cyclic = repository.commits[id].parents.some(visit);
    visiting.delete(id);
    visited.add(id);
    return cyclic;
  };
  return Object.keys(repository.commits).some(visit);
}

function validCommitId(id: string, limits: PuzzleLimits) {
  return id.length <= limits.maxCommitIdLength && COMMIT_ID_PATTERN.test(id);
}

function validBranchName(name: string, limits: PuzzleLimits) {
  return name.length <= limits.maxBranchNameLength && BRANCH_NAME_PATTERN.test(name) && !name.includes("..") && !name.endsWith("/") && !name.endsWith(".");
}

function boundedStrings(values: string[], maxCount: number, maxLength: number, path: string, issues: ValidationIssue[], sizeCode: string) {
  if (values.length > maxCount) add(issues, sizeCode, `At most ${maxCount} entries are allowed.`, path);
  values.forEach((value, index) => text(value, maxLength, `${path}[${index}]`, issues));
}

function text(value: string, maximum: number, path: string, issues: ValidationIssue[]) {
  if (value.trim().length === 0) add(issues, "content.empty-string", "This text field must not be empty.", path);
  if (value.length > maximum) add(issues, "limits.string-length", `This string exceeds the configured limit of ${maximum} characters.`, path);
}

function isJson(value: unknown, remainingDepth: number): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (remainingDepth <= 0 || typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) return value.every((item) => isJson(item, remainingDepth - 1));
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  return Object.values(value).every((item) => isJson(item, remainingDepth - 1));
}

function add(issues: ValidationIssue[], code: string, message: string, path: string) {
  issues.push({ code, message, path });
}
