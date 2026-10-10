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

/** One line of an interactive-rebase todo list. Only pick and squash are simulated. */
export interface RebaseTodoItem {
  action: "pick" | "squash";
  commit: string;
}

export type GitAction =
  | { type: "switch"; branch: string }
  | { type: "log"; all: boolean }
  | { type: "merge"; branch: string; ffOnly: boolean }
  | { type: "cherry-pick"; commit: string }
  | { type: "revert"; commit: string }
  | { type: "rebase"; onto: string }
  /** Without a todo list, every commit is picked, as if the editor were saved unchanged. */
  | { type: "interactive-rebase"; onto: string; todo?: RebaseTodoItem[] };

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

/** What a goal asks for, as data, so interfaces can phrase it in any language. */
export type GoalSpec =
  | { type: "snapshot"; branch: string }
  | { type: "head"; branch: string }
  | { type: "branch-head"; branch: string; commit: string }
  | { type: "provenance"; provenance: CommitProvenance["type"]; commits: string[] }
  | { type: "action"; command: string };

/** One player-facing completion condition and whether the repository meets it now. */
export interface GoalCheck {
  id: string;
  /** English wording; localized interfaces render from `goal` instead. */
  label: string;
  met: boolean;
  goal: GoalSpec;
}

export interface ValidationResult {
  solved: boolean;
  unmet: string[];
  /** Every condition, met or not, in display order. */
  checks: GoalCheck[];
}
