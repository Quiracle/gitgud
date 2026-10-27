import certificates from "./certificates.json";
import { DETERMINISTIC_GENERATOR_VERSION, mechanicsSignature } from "./deterministic";
import { createTemplateCandidate, hasStrategicProof } from "./templates";
import { createTemplateLocalizations } from "./editorial";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleDifficulty } from "../types";

export const DAILY_STORY_PROMPT_VERSION = 3;
export const DAILY_MINIMUM_COMMANDS = { easy: 2, medium: 4, hard: 6 } as const;
export interface RecentMechanics { signature: string; family: string }
interface Certificate {
  templateId: string; difficulty: string; family: string;
  generatorVersion: number; evaluatorVersion: number; minimumCommands: number; signature: string;
  search: { status: string; excludedThroughDepth: number; transitions: number };
}
const registry = certificates.certificates as Certificate[];
export const DAILY_CERTIFICATION = {
  sourceFingerprint: certificates.sourceFingerprint,
  templates: registry.map(({ templateId, difficulty, family, minimumCommands }) => ({ templateId, difficulty, family, minimumCommands })),
};

/** Newest first. Repetition is avoided when alternatives exist, never hidden by recoloring. */
export function selectDailyTemplate(difficulty: PuzzleDifficulty, seed: string, recent: readonly RecentMechanics[] = []): string {
  const candidates = registry.filter(c => c.difficulty === difficulty);
  if (!candidates.length) throw new Error("No certified templates for the reserved difficulty.");
  const rank = (c: Certificate) => recent.slice(0, 14).reduce((penalty, entry, index) =>
    penalty + (entry.signature === c.signature ? 1000 : entry.family === c.family ? 100 : 0) * (14 - index), 0);
  candidates.sort((a, b) => rank(a) - rank(b) || seedRank(`${seed}:${a.templateId}`) - seedRank(`${seed}:${b.templateId}`) || a.templateId.localeCompare(b.templateId));
  return candidates[0].templateId;
}

/**
 * Instantiates only mechanically isomorphic, exhaustively certified templates.
 * Semantic renaming preserves the engine's equality tests; ID/ancestry/branch
 * changes are not normalized away. A newly introduced topology must be certified
 * offline before it can be published. Runtime proof replay is still mandatory.
 */
export function createCertifiedDaily(date: string, difficulty: PuzzleDifficulty, seed: string, templateId: string) {
  const certificate = registry.find(c => c.templateId === templateId && c.difficulty === difficulty);
  if (!certificate || certificate.generatorVersion !== DETERMINISTIC_GENERATOR_VERSION ||
      certificate.search.status !== "exhausted" || certificate.minimumCommands !== DAILY_MINIMUM_COMMANDS[difficulty] ||
      certificate.search.excludedThroughDepth < certificate.minimumCommands - 1) {
    throw new Error("Missing or incomplete daily difficulty certificate.");
  }
  const generated = createTemplateCandidate(templateId, date, seed);
  if (mechanicsSignature(generated.candidate) !== certificate.signature) throw new Error("Generated mechanics differ from the certified template.");
  const localizations = createTemplateLocalizations(generated.candidate, generated.family, seed);
  const candidate = {
    ...generated.candidate,
    title: localizations.en.title, description: localizations.en.description,
    objectives: localizations.en.objectives, hints: localizations.en.hints,
    initialRepository: {
      ...generated.candidate.initialRepository,
      commits: Object.fromEntries(Object.entries(generated.candidate.initialRepository.commits).map(([id, commit]) => [id, { ...commit, message: localizations.en.commitMessages[id] }])),
    },
    localizations,
  };
  const validation = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok || validation.value.puzzle.parCommands !== certificate.minimumCommands ||
      (difficulty !== "easy" && !hasStrategicProof(candidate))) {
    throw new Error("Certified daily failed its normal publication validator.");
  }
  return {
    ...generated, candidate, templateId,
    quality: {
      evaluatorVersion: certificate.evaluatorVersion,
      minimumCommands: certificate.minimumCommands,
      excludedThroughDepth: certificate.search.excludedThroughDepth,
      proofCommands: validation.value.puzzle.parCommands!,
      certification: certificates.sourceFingerprint,
      strategicProof: hasStrategicProof(candidate),
    },
  };
}

function seedRank(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
