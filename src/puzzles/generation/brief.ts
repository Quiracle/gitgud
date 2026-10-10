import {
  CHICKEN_ACCESSORY_SLOTS,
  CHICKEN_COLORS,
  EMPTY_CHICKEN_STATE,
  type ChickenState,
} from "../chickenTheme";
import type { PuzzleDifficulty, SupportedCommand } from "../types";
import {
  GENERATION_BRIEF_VERSION,
  GENERATION_PROMPT_VERSION,
  type GenerationBrief,
  type GitConcept,
  type GraphArchetype,
} from "./types";

const STORY_THEMES = [
  "royal portrait",
  "beach holiday",
  "space mission",
  "detective case",
  "concert night",
  "winter expedition",
  "garden party",
  "sports day",
] as const;

interface DifficultyProfile {
  branches: readonly [number, number];
  commits: readonly [number, number];
  accessories: readonly [number, number];
  concepts: readonly [number, number];
  solution: readonly [number, number];
  hints: readonly [number, number];
  archetypes: readonly GraphArchetype[];
}

const ARCHETYPE_CONCEPT_OPTIONS: Record<GraphArchetype, readonly (readonly GitConcept[])[]> = {
  "single-transfer": [["switch"], ["cherry-pick"], ["revert"]],
  "fast-forward": [["merge"], ["ff-only"]],
  "divergent-merge": [["switch", "merge"]],
  "curate-and-undo": [["cherry-pick", "revert"], ["merge", "revert"]],
  "multi-branch-curation": [["switch", "cherry-pick", "revert"], ["switch", "merge", "revert"]],
};

export const GENERATION_PROFILES: Record<PuzzleDifficulty, DifficultyProfile> = {
  easy: {
    branches: [2, 2], commits: [3, 5], accessories: [1, 2], concepts: [1, 1],
    solution: [1, 3], hints: [2, 2],
    archetypes: ["single-transfer", "fast-forward"],
  },
  medium: {
    branches: [2, 3], commits: [5, 8], accessories: [2, 3], concepts: [2, 2],
    solution: [2, 5], hints: [1, 2],
    archetypes: ["divergent-merge", "curate-and-undo"],
  },
  hard: {
    branches: [3, 4], commits: [8, 14], accessories: [3, 5], concepts: [2, 3],
    solution: [3, 7], hints: [1, 1],
    archetypes: ["curate-and-undo", "multi-branch-curation"],
  },
};

export function createGenerationBrief(
  date: string,
  difficulty: PuzzleDifficulty,
  seed: string,
): GenerationBrief {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Daily puzzle date must use YYYY-MM-DD.");
  if (!seed.trim()) throw new Error("A non-empty generation seed is required.");

  const random = seededRandom(`${date}:${difficulty}:${seed}`);
  const profile = GENERATION_PROFILES[difficulty];
  const branchCount = integer(random, ...profile.branches);
  const commitCount = integer(random, ...profile.commits);
  const targetState = chooseTargetState(random, integer(random, ...profile.accessories));
  const graphArchetype = pick(random, profile.archetypes);
  const compatibleOptions = ARCHETYPE_CONCEPT_OPTIONS[graphArchetype].filter(
    (option) => option.length >= profile.concepts[0] && option.length <= profile.concepts[1],
  );
  const requiredConcepts = [...pick(random, compatibleOptions)];

  return {
    date,
    seed,
    briefVersion: GENERATION_BRIEF_VERSION,
    promptVersion: GENERATION_PROMPT_VERSION,
    difficulty,
    branchCount,
    commitCount,
    graphArchetype,
    targetState,
    requiredConcepts,
    allowedCommands: commandsFor(requiredConcepts),
    solutionLength: { min: profile.solution[0], max: profile.solution[1] },
    hintCount: integer(random, ...profile.hints),
    storyTheme: pick(random, STORY_THEMES),
  };
}

function chooseTargetState(random: () => number, count: number): ChickenState {
  const state = { ...EMPTY_CHICKEN_STATE };
  for (const slot of sample(random, CHICKEN_ACCESSORY_SLOTS, count)) {
    state[slot] = pick(random, CHICKEN_COLORS);
  }
  return state;
}

function commandsFor(concepts: GitConcept[]): SupportedCommand[] {
  const commands = new Set<SupportedCommand>(["log", "switch"]);
  concepts.forEach((concept) => {
    if (concept === "ff-only" || concept === "merge") commands.add("merge");
    else commands.add(concept);
  });
  return [...commands];
}

function integer(random: () => number, minimum: number, maximum: number) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

function sample<T>(random: () => number, values: readonly T[], count: number): T[] {
  const available = [...values];
  const result: T[] = [];
  while (result.length < count && available.length > 0) {
    result.push(available.splice(Math.floor(random() * available.length), 1)[0]);
  }
  return result;
}

/** xmur3 + mulberry32: compact deterministic PRNG suitable for content selection, not security. */
function seededRandom(seed: string): () => number {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    let value = (hash += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
