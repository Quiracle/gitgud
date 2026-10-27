import { CHICKEN_V2_SEMANTIC_POLICY, EMPTY_CHICKEN_STATE, type ChickenColor } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, PuzzleDifficulty } from "../types";
import { DETERMINISTIC_GENERATOR_VERSION, SUPPORTED_ACTION_TYPES, mechanicsSignature } from "./deterministic";

export type IntegrationDifficulty = Extract<PuzzleDifficulty, "medium" | "hard">;

const COLORS: ChickenColor[] = ["red", "blue", "turquoise", "purple", "gold"];
const ACCESSORIES = ["sunglasses", "scarf", "longLegs"] as const;

/**
 * Prepares useful work on feature, removes its body-color distraction, then
 * integrates the finished accessory chain. Hard adds a separate repair branch.
 */
export function createIntegrationCandidate(
  date: string,
  difficulty: IntegrationDifficulty,
  seed: string,
) {
  validateInputs(date, difficulty, seed);
  const random = createRandom(`${date}|prepare-and-integrate|${difficulty}|${seed}`);
  const accessories = shuffled(ACCESSORIES, random);
  const colors = shuffled(COLORS, random);
  const primary = accessories[0];
  const targetColor = colors[3];
  const commits: PuzzleCandidate["initialRepository"]["commits"] = {};
  const addCommit = (id: string, parent: string, message: string, changes: { property: string; from: unknown; to: unknown }[]) => {
    commits[id] = { id, parents: [parent], message, changes: changes.map((change) => ({ type: "set", ...change })), provenance: { type: "original", sourceCommits: [] } };
  };
  commits.c1 = { id: "c1", parents: [], message: "Create the empty repository", changes: [], provenance: { type: "original", sourceCommits: [] } };
  addCommit("c2", "c1", "Color the chicken black", [{ property: "body", from: "cream", to: "black" }]);
  addCommit("c3", "c1", "Add an unwanted red body color", [{ property: "body", from: "cream", to: "red" }]);
  let previous = "c3";
  for (let index = 0; index < 4; index += 1) {
    const id = `c${index + 4}`;
    addCommit(id, previous, `Set ${primary} to ${colors[index]}`, [
      { property: primary, from: index === 0 ? "none" : colors[index - 1], to: colors[index] },
    ]);
    previous = id;
  }

  const branches: Record<string, string> = { main: "c2", feature: "c7" };
  let mainHead = "c2";
  const solutionCommands = ["git switch feature", "git revert c3", "git switch main", "git merge feature"];
  const targetSnapshot: Record<string, unknown> = { ...EMPTY_CHICKEN_STATE, body: "black", [primary]: targetColor };

  if (difficulty === "hard") {
    const secondary = accessories[1];
    const secondaryTarget = colors[2];
    const wrong = COLORS.find((color) => color !== secondaryTarget)!;
    addCommit("c8", "c2", `Add the wrong ${secondary}`, [{ property: secondary, from: "none", to: wrong }]);
    addCommit("c9", "c1", "Color the repair branch blue", [{ property: "body", from: "cream", to: "blue" }]);
    addCommit("c10", "c9", `Add the desired ${secondary}`, [{ property: secondary, from: "none", to: secondaryTarget }]);
    branches.main = "c8";
    branches.repair = "c10";
    mainHead = "c8";
    solutionCommands.push("git revert c8", "git cherry-pick c10");
    targetSnapshot[secondary] = secondaryTarget;
  }

  const id = `daily-${date}`;
  const candidate: PuzzleCandidate = {
    schemaVersion: 2,
    themeId: "chicken-v1",
    id,
    version: 1,
    kind: "daily",
    slug: id,
    title: "Prepare and Integrate",
    description: "Prepare the accessory on feature, clean its distraction, and integrate the finished work.",
    difficulty,
    publishedOn: date,
    objectives: ["Finish the accessory work on main without the unwanted body color."],
    initialRepository: {
      commits,
      branches,
      currentBranch: "main",
      head: mainHead,
      initialState: { ...EMPTY_CHICKEN_STATE, body: "cream" },
      nextGeneratedId: 1,
    },
    target: { branch: "main", snapshot: targetSnapshot },
    allowedCommands: [...SUPPORTED_ACTION_TYPES],
    hints: ["The feature branch has a distraction before its useful work.", "Remove the distraction before integrating feature.", "On hard, repair the second accessory separately."],
    solutionCommands,
  };
  const validation = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok) {
    throw new Error(`Integration candidate failed validation: ${validation.issues.map((issue) => `${issue.code} at ${issue.path}`).join(", ")}`);
  }
  return {
    candidate,
    family: "prepare-and-integrate",
    signature: mechanicsSignature(candidate),
    generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
  };
}

function validateInputs(date: string, difficulty: IntegrationDifficulty, seed: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Error("date must be a valid YYYY-MM-DD calendar date.");
  }
  if (difficulty !== "medium" && difficulty !== "hard") throw new Error("difficulty must be medium or hard.");
  if (typeof seed !== "string" || seed.trim().length === 0 || seed.length > 256) throw new Error("seed must be a non-empty string of at most 256 characters.");
}

function createRandom(input: string) {
  let state = Number.parseInt(hashString(input), 36) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function hashString(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}
