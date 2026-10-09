export type SemanticState = Record<string, unknown>;

export interface SetChange {
  type: "set";
  property: string;
  from: unknown;
  to: unknown;
}

export type SemanticChange = SetChange;

export interface CommitProvenance {
  type:
    | "original"
    | "cherry-pick"
    | "revert"
    | "merge"
    | "rebase"
    | "squash";
  sourceCommits?: string[];
}

export interface Commit {
  id: string;
  parents: string[];
  message: string;
  changes: SemanticChange[];
  provenance?: CommitProvenance;
}

export interface Repository {
  commits: Record<string, Commit>;
  branches: Record<string, string>;
  currentBranch: string;
  head: string;
  initialState: SemanticState;
  nextGeneratedId: number;
}

export type GitAction =
  | { type: "switch"; branch: string }
  | { type: "log"; all: boolean }
  | { type: "merge"; branch: string; ffOnly: boolean }
  | { type: "cherry-pick"; commit: string }
  | { type: "revert"; commit: string };

export interface CommandSuccess {
  ok: true;
  repository: Repository;
  output: string[];
  action: GitAction;
  mutated: boolean;
}

export interface CommandFailure {
  ok: false;
  repository: Repository;
  output: string[];
  error: string;
}

export type CommandResult = CommandSuccess | CommandFailure;

export interface ParseSuccess {
  ok: true;
  action: GitAction;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult = ParseSuccess | ParseFailure;

export interface RequiredProvenance {
  type: CommitProvenance["type"];
  sourceCommit: string;
}

export interface PuzzleTarget {
  branch: string;
  snapshot: SemanticState;
  branchHeads?: Record<string, string>;
  requiredProvenance?: RequiredProvenance[];
}

export interface ValidationResult {
  solved: boolean;
  unmet: string[];
}

export interface PuzzleDefinition {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  initialRepository: Repository;
  target: PuzzleTarget;
  targetState: SemanticState;
}
