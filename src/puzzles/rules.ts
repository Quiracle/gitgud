import { SUPPORTED_ACTION_TYPES, type GitAction, type PuzzleTarget } from "../engine";
import type { PublicPuzzleDefinition, SupportedCommand } from "./types";

/**
 * The one policy boundary shared by play, completion, publishing, and command help.
 * Daily definitions may retain older authored metadata, but it never narrows play or
 * adds history requirements to a daily win.
 */
export interface PuzzleRules {
  allowedCommands: readonly SupportedCommand[];
  target: PuzzleTarget;
  actionRequirements: NonNullable<PublicPuzzleDefinition["actionRequirements"]>;
}

export function resolvePuzzleRules(puzzle: PublicPuzzleDefinition): PuzzleRules {
  if (puzzle.kind === "daily") {
    return {
      allowedCommands: SUPPORTED_ACTION_TYPES,
      target: { branch: "main", snapshot: puzzle.target.snapshot },
      actionRequirements: [],
    };
  }
  return {
    allowedCommands: puzzle.allowedCommands,
    target: puzzle.target,
    actionRequirements: puzzle.actionRequirements ?? [],
  };
}

export function isPuzzleActionAllowed(puzzle: PublicPuzzleDefinition, action: GitAction): boolean {
  return resolvePuzzleRules(puzzle).allowedCommands.includes(action.type);
}
