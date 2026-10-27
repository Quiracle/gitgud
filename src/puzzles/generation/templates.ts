import { parseGitCommand } from "../../engine";
import type { PuzzleCandidate, PuzzleDifficulty } from "../types";
import { createBundledCandidate, createDeterministicCandidate } from "./deterministic";
import { createIntegrationCandidate } from "./integration";
import { createWorkshopCandidate } from "./workshop";

// Curated mechanics, not a count of commands disguised as difficulty. Repeated
// pick/repair modules remain useful easy material but are retired above easy.
export const DAILY_TEMPLATE_IDS = ["easy-0", "easy-1", "easy-4", "medium-4", "medium-5", "medium-6", "hard-5", "hard-6"] as const;

export function createTemplateCandidate(templateId: string, date: string, seed: string) {
  if (!(DAILY_TEMPLATE_IDS as readonly string[]).includes(templateId)) throw new Error("Unapproved daily template.");
  const [level, version] = templateId.split("-");
  const difficulty = level as PuzzleDifficulty;
  const variant = Number(version);
  if (variant === 6 && difficulty !== "easy") return createWorkshopCandidate(date, difficulty, seed);
  if (variant === 5 && difficulty !== "easy") return createIntegrationCandidate(date, difficulty, seed);
  if (variant === 4) return createBundledCandidate(date, difficulty, seed);
  return createDeterministicCandidate(date, difficulty, seed, variant);
}

/** Combined with a shortest proof, this excludes padded or purely copying hard proofs. */
export function hasStrategicProof(candidate: PuzzleCandidate): boolean {
  return candidate.solutionCommands.some(command => {
    const parsed = parseGitCommand(command);
    return parsed.ok && ["merge", "rebase", "interactive-rebase"].includes(parsed.action.type);
  });
}
