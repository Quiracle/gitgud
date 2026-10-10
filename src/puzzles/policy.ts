import type { SemanticState } from "../engine";
import type { JsonValue, PuzzleDifficulty } from "./types";

/** Limits are deliberately data, so browser and server validation use the same bounds. */
export interface PuzzleLimits {
  maxCommitIdLength: number;
  maxBranchNameLength: number;
  maxPuzzleIdLength: number;
  maxSlugLength: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxCommitMessageLength: number;
  maxHintLength: number;
  maxObjectiveLength: number;
  maxSolutionCommandLength: number;
  maxCommits: number;
  maxBranches: number;
  maxChangesPerCommit: number;
  maxParentsPerCommit: number;
  maxTotalChanges: number;
  maxProvenanceSourcesPerCommit: number;
  maxRequiredProvenance: number;
  maxRequiredActions: number;
  maxTargetBranchHeads: number;
  maxHints: number;
  maxObjectives: number;
  maxSolutionCommands: number;
  maxSemanticValueDepth: number;
}

export const DEFAULT_PUZZLE_LIMITS: PuzzleLimits = {
  maxCommitIdLength: 48,
  maxBranchNameLength: 48,
  maxPuzzleIdLength: 64,
  maxSlugLength: 80,
  maxTitleLength: 120,
  maxDescriptionLength: 600,
  maxCommitMessageLength: 240,
  maxHintLength: 240,
  maxObjectiveLength: 240,
  maxSolutionCommandLength: 160,
  maxCommits: 25,
  maxBranches: 8,
  maxChangesPerCommit: 12,
  maxParentsPerCommit: 2,
  maxTotalChanges: 80,
  maxProvenanceSourcesPerCommit: 4,
  maxRequiredProvenance: 8,
  maxRequiredActions: 6,
  maxTargetBranchHeads: 8,
  maxHints: 6,
  maxObjectives: 10,
  maxSolutionCommands: 20,
  maxSemanticValueDepth: 8,
};

/** Commit IDs cannot contain path separators; branches may use a simple slash namespace. */
export const COMMIT_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const BRANCH_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9._/-]*$/;
export const PUZZLE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export interface SemanticPolicy {
  /** Every key is an accepted property and every listed JSON value is accepted exactly. */
  properties: Record<string, readonly JsonValue[]>;
  /** Defaults to every configured property, ensuring snapshots are complete illustrations. */
  requiredProperties?: readonly string[];
  /** Optional theme-specific visual rule applied to every publishable snapshot. */
  validateState?: (state: SemanticState) => string | undefined;
}

export interface DifficultyConstraint {
  minCommits?: number;
  maxCommits?: number;
  minBranches?: number;
  maxBranches?: number;
  minSolutionCommands?: number;
  maxSolutionCommands?: number;
  minHints?: number;
  maxHints?: number;
}

export type DifficultyPolicy = Record<PuzzleDifficulty, DifficultyConstraint>;

/** Starting complexity bounds; callers may tighten these for a particular release. */
export const DEFAULT_DIFFICULTY_POLICY: DifficultyPolicy = {
  easy: { maxCommits: 8, maxBranches: 3, maxSolutionCommands: 5, minHints: 1 },
  medium: {
    minCommits: 3,
    maxCommits: 14,
    minBranches: 2,
    maxBranches: 5,
    minSolutionCommands: 2,
    maxSolutionCommands: 10,
  },
  hard: {
    minCommits: 5,
    maxCommits: 25,
    minBranches: 2,
    maxBranches: 8,
    minSolutionCommands: 3,
    maxSolutionCommands: 20,
  },
};

export interface PuzzleValidationConfig {
  semantic: SemanticPolicy;
  limits?: Partial<PuzzleLimits>;
  difficultyPolicy?: DifficultyPolicy;
}
