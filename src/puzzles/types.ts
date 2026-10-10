import type { GitAction, PuzzleTarget, Repository } from "../engine";

/** Values that can cross the puzzle publication boundary without coercion. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const PUZZLE_SCHEMA_VERSION = 1 as const;
export const DAILY_PUZZLE_SCHEMA_VERSION = 2 as const;
export type PuzzleSchemaVersion =
  | typeof PUZZLE_SCHEMA_VERSION
  | typeof DAILY_PUZZLE_SCHEMA_VERSION;

export type PuzzleKind = "daily" | "lesson" | "generated";
export type PuzzleDifficulty = "easy" | "medium" | "hard";

/** Commands represented by the simulator's typed actions, not arbitrary terminal text. */
export type SupportedCommand = GitAction["type"];

/**
 * A public, unordered completion condition. Fields constrain a command variant only
 * when they are present; `log.all` and `merge.ffOnly` are required to distinguish
 * their meaningful simulator variants.
 */
export type ActionRequirement =
  | { type: "log"; all: boolean }
  | { type: "merge"; ffOnly: boolean }
  | { type: "switch"; branch?: string }
  | { type: "cherry-pick"; commit?: string }
  | { type: "revert"; commit?: string };

/**
 * Safe to send to a player. It intentionally has no solution transcript.
 * `objectives` remains optional while the provisional UI is still present.
 */
export interface PublicPuzzleDefinition {
  schemaVersion: PuzzleSchemaVersion;
  /** Required by schema v2. Version 1 lessons use the legacy chicken renderer. */
  themeId?: "chicken-v1";
  id: string;
  version: number;
  kind: PuzzleKind;
  slug: string;
  title: string;
  description: string;
  difficulty: PuzzleDifficulty;
  /** Canonical UTC publication date for official daily puzzles. */
  publishedOn?: string;
  objectives?: string[];
  initialRepository: Repository;
  target: PuzzleTarget;
  allowedCommands: SupportedCommand[];
  hints: string[];
  actionRequirements?: ActionRequirement[];
}

/** Private data retained by a publisher for an explicit future solution reveal. */
export interface PuzzlePrivateMetadata {
  solutionCommands: string[];
}

/** A validated package is intentionally split before public publication. */
export interface ValidatedPuzzle {
  puzzle: PublicPuzzleDefinition;
  privateMetadata: PuzzlePrivateMetadata;
}

/** Untrusted candidates have the same public fields plus a hidden transcript. */
export interface PuzzleCandidate extends PublicPuzzleDefinition {
  solutionCommands: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  path: string;
}

export type PuzzleValidationResult =
  | { ok: true; value: ValidatedPuzzle }
  | { ok: false; issues: ValidationIssue[] };
