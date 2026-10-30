import { cloneRepository, executeCommand } from "../engine";
import type { GitAction } from "../engine";
import { validatePuzzleCompletion } from "./completion";
import type { PublicPuzzleDefinition } from "./types";

/** The commands up to the first winning state, or undefined when they never win. */
export function routeThroughFirstWin(puzzle: PublicPuzzleDefinition, commands: readonly string[]): string[] | undefined {
  let repository = cloneRepository(puzzle.initialRepository);
  const actions: GitAction[] = [];
  for (const [index, command] of commands.entries()) {
    const result = executeCommand(repository, command);
    if (!result.ok) return undefined;
    repository = result.repository;
    actions.push(result.action);
    if (validatePuzzleCompletion(puzzle, repository, actions).solved) return commands.slice(0, index + 1);
  }
  return undefined;
}
