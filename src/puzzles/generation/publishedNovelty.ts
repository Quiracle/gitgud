import { executeCommand } from "../../engine";
import { validatePuzzleCompletion } from "../completion";
import { parsePublicPuzzleDefinition } from "../schema";
import { fingerprintDecisionCore } from "./decisionCore";
import { fingerprintMechanics } from "./novelty";

/** Read historical puzzles without rewriting their definition or recertifying difficulty. */
export function publishedPuzzleNovelty(definition: unknown, solutionCommands: unknown) {
  const parsed = parsePublicPuzzleDefinition(definition);
  if (!parsed.puzzle || parsed.puzzle.kind !== "daily" || !Array.isArray(solutionCommands) ||
      solutionCommands.length > 100 || !solutionCommands.every(command => typeof command === "string" && command.length <= 1000)) {
    throw new Error("Published novelty comparison needs a valid daily definition and private proof.");
  }
  const puzzle = { ...parsed.puzzle, target: { branch: "main", snapshot: parsed.puzzle.target.snapshot } };
  let repository = puzzle.initialRepository;
  const proof: string[] = [];
  // Older proofs can continue after today's state-only win. Only relevant work
  // through the first win belongs to the comparison; legacy history goals do not.
  for (const command of solutionCommands) {
    if (validatePuzzleCompletion(puzzle, repository, []).solved) break;
    const step = executeCommand(repository, command);
    if (!step.ok) throw new Error("Historical proof needs review before novelty coverage can be claimed.");
    repository = step.repository;
    proof.push(command);
  }
  if (!validatePuzzleCompletion(puzzle, repository, []).solved) throw new Error("Historical proof does not reach the current daily target.");
  return {
    mechanics: fingerprintMechanics(puzzle.initialRepository, puzzle.target).canonical,
    decisionCore: fingerprintDecisionCore({ ...puzzle, solutionCommands: proof }),
  };
}
