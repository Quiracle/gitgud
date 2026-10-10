import type { ChickenState } from "../chickenTheme";
import type { PuzzleDifficulty, SupportedCommand, ValidationIssue } from "../types";

export const GENERATION_BRIEF_VERSION = 1 as const;
export const GENERATION_PROMPT_VERSION = 1 as const;

export type GitConcept = "switch" | "merge" | "ff-only" | "cherry-pick" | "revert";
export type GraphArchetype =
  | "single-transfer"
  | "fast-forward"
  | "divergent-merge"
  | "curate-and-undo"
  | "multi-branch-curation";

export interface GenerationBrief {
  date: string;
  seed: string;
  briefVersion: typeof GENERATION_BRIEF_VERSION;
  promptVersion: typeof GENERATION_PROMPT_VERSION;
  difficulty: PuzzleDifficulty;
  branchCount: number;
  commitCount: number;
  graphArchetype: GraphArchetype;
  targetState: ChickenState;
  requiredConcepts: GitConcept[];
  allowedCommands: SupportedCommand[];
  solutionLength: { min: number; max: number };
  hintCount: number;
  storyTheme: string;
}

export interface BriefValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
