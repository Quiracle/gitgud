import { executeCommand, parseGitCommand } from "../engine";
import { validatePuzzleCompletion } from "./completion";
import type { PublicPuzzleDefinition } from "./types";

/**
 * Counts the private proof only through its first winning state. `git log` is
 * informational, while an interactive rebase (including its todo) is one command.
 */
export function deriveParCommands(puzzle: PublicPuzzleDefinition, solutionCommands: readonly string[]): number | undefined {
  let repository = structuredClone(puzzle.initialRepository);
  const actions = [];
  let count = 0;
  for (const command of solutionCommands) {
    const parsed = parseGitCommand(command);
    if (!parsed.ok) return undefined;
    const result = executeCommand(repository, command);
    if (!result.ok) return undefined;
    repository = result.repository;
    actions.push(result.action);
    if (result.action.type !== "log") count += 1;
    if (validatePuzzleCompletion(puzzle, repository, actions).solved) return count;
  }
  return undefined;
}
