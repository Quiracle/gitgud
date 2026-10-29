import { CHICKEN_V2_SEMANTIC_POLICY, EMPTY_CHICKEN_STATE, type ChickenAccessorySlot, type ChickenColor } from "../chickenTheme";
import { SUPPORTED_ACTION_TYPES as ENGINE_SUPPORTED_ACTION_TYPES } from "../../engine";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, PuzzleDifficulty, SupportedCommand } from "../types";

/** Re-export the engine's command catalog: official daily puzzles allow every action. */
export const SUPPORTED_ACTION_TYPES: readonly SupportedCommand[] = ENGINE_SUPPORTED_ACTION_TYPES;

export const DETERMINISTIC_GENERATOR_VERSION = 1;

const SLOTS: ChickenAccessorySlot[] = ["sunglasses", "scarf", "longLegs", "hat", "crest"];
const COLORS: ChickenColor[] = ["red", "blue", "turquoise", "purple", "gold"];
const COLORS_WITHOUT_BLUE: ChickenColor[] = ["red", "turquoise", "purple", "gold"];
const MODULE_COUNTS: Record<PuzzleDifficulty, number> = { easy: 1, medium: 2, hard: 3 };
const BRANCHES = ["feature", "style", "polish"] as const;

type ModuleKind = "dependency" | "repair";

export interface DeterministicCandidateResult {
  candidate: PuzzleCandidate;
  family: string;
  signature: string;
  generatorVersion: number;
}

/**
 * Produces a reproducible puzzle from trusted inputs. No model output is involved;
 * its short English text is a safe fallback for generation outages.
 */
export function createDeterministicCandidate(
  date: string,
  difficulty: PuzzleDifficulty,
  seed: string,
  variant = 0,
): DeterministicCandidateResult {
  validateInputs(date, difficulty, seed, variant);

  const moduleCount = MODULE_COUNTS[difficulty];
  const random = createRandom(`${date}|${difficulty}|${seed}|${variant}`);
  const slots = selectSlots(moduleCount, random);
  const colors = shuffled(COLORS, random);
  const moduleKinds = modulePattern(moduleCount, variant);
  const blockerColors = shuffled(COLORS_WITHOUT_BLUE, random).slice(0, moduleCount);

  const commits: PuzzleCandidate["initialRepository"]["commits"] = {};
  const addCommit = (id: string, parent: string | undefined, message: string, changes: { property: string; from: unknown; to: unknown }[]) => {
    commits[id] = { id, parents: parent ? [parent] : [], message, changes: changes.map((change) => ({ type: "set", ...change })), provenance: { type: "original", sourceCommits: [] } };
  };
  addCommit("c1", undefined, "Create the empty repository", []);
  addCommit("c2", "c1", "Color the chicken black", [{ property: "body", from: "cream", to: "black" }]);

  const branches: Record<string, string> = { main: "c2" };
  let nextId = 3;
  let mainHead = "c2";
  const solutionCommands: string[] = [];
  const targetSnapshot: Record<string, unknown> = { ...EMPTY_CHICKEN_STATE, body: "black" };

  for (let index = 0; index < moduleCount; index += 1) {
    const slot = slots[index];
    const desired = colors[index];
    const branch = BRANCHES[index];
    const branchBody = blockerColors[index];
    const poisonId = `c${nextId++}`;
    addCommit(poisonId, "c1", `Color the chicken ${branchBody} on ${branch}`, [{ property: "body", from: "cream", to: branchBody }]);
    let branchHead = poisonId;

    if (moduleKinds[index] === "dependency") {
      const interim = COLORS.find((color) => color !== desired && color !== branchBody)!;
      const firstId = `c${nextId++}`;
      addCommit(firstId, branchHead, `Add ${interim} ${slot}`, [{ property: slot, from: "none", to: interim }]);
      branchHead = firstId;
      const finalId = `c${nextId++}`;
      addCommit(finalId, branchHead, `Change ${slot} to ${desired}`, [{ property: slot, from: interim, to: desired }]);
      branchHead = finalId;
      solutionCommands.push(`git cherry-pick ${firstId}`, `git cherry-pick ${finalId}`);
    } else {
      const wrong = COLORS.find((color) => color !== desired && color !== branchBody)!;
      const badId = `c${nextId++}`;
      addCommit(badId, mainHead, `Add the wrong ${slot}`, [{ property: slot, from: "none", to: wrong }]);
      mainHead = badId;
      const desiredId = `c${nextId++}`;
      addCommit(desiredId, branchHead, `Add ${desired} ${slot} on ${branch}`, [{ property: slot, from: "none", to: desired }]);
      branchHead = desiredId;
      solutionCommands.push(`git revert ${badId}`, `git cherry-pick ${desiredId}`);
    }

    branches[branch] = branchHead;
    targetSnapshot[slot] = desired;
  }
  branches.main = mainHead;

  const id = `daily-${date}`;
  const candidate: PuzzleCandidate = {
    schemaVersion: 2,
    themeId: "chicken-v1",
    id,
    version: 1,
    kind: "daily",
    slug: id,
    title: "A Chicken Makeover",
    description: "Give the chicken its final look by curating work across branches.",
    difficulty,
    publishedOn: date,
    objectives: ["Make main match the illustrated target."],
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
    hints: ["Each side branch contains useful accessory work.", "Cherry-pick the useful changes onto main.", "Revert any mainline accessory that conflicts with the target."],
    solutionCommands,
  };

  const validation = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok) {
    throw new Error(`Deterministic candidate failed validation: ${validation.issues.map((issue) => `${issue.code} at ${issue.path}`).join(", ")}`);
  }

  const family = familyForPattern(moduleKinds);
  const signature = mechanicsSignature(candidate);
  return { candidate, family, signature, generatorVersion: DETERMINISTIC_GENERATOR_VERSION };
}

/** Bundles useful accessory work with a nuisance change that must be cleaned up. */
export function createBundledCandidate(
  date: string,
  difficulty: PuzzleDifficulty,
  seed: string,
): DeterministicCandidateResult {
  validateInputs(date, difficulty, seed, 0);
  const count = MODULE_COUNTS[difficulty];
  const random = createRandom(`${date}|bundled|${difficulty}|${seed}`);
  const desiredSlots = shuffled(["sunglasses", "scarf", "longLegs"] as const, random).slice(0, count);
  const nuisanceSlots = shuffled(["body", "hat", "crest"] as const, random).slice(0, count);
  const colors = shuffled(COLORS, random);
  const commits: PuzzleCandidate["initialRepository"]["commits"] = {};
  const branches: Record<string, string> = { main: "c1" };
  const solutionCommands: string[] = [];
  const targetSnapshot: Record<string, unknown> = { ...EMPTY_CHICKEN_STATE, body: "cream" };
  const addCommit = (id: string, parent: string, message: string, changes: { property: string; from: unknown; to: unknown }[]) => {
    commits[id] = { id, parents: [parent], message, changes: changes.map((change) => ({ type: "set", ...change })), provenance: { type: "original", sourceCommits: [] } };
  };
  commits.c1 = { id: "c1", parents: [], message: "Create the empty repository", changes: [], provenance: { type: "original", sourceCommits: [] } };

  let nextId = 2;
  for (let index = 0; index < count; index += 1) {
    const branch = BRANCHES[index];
    const nuisance = nuisanceSlots[index];
    const desiredSlot = desiredSlots[index];
    const color = colors[index];
    const nuisanceColor = color;
    const baseline = nuisance === "body" ? "cream" : "none";
    const first = `c${nextId++}`;
    addCommit(first, "c1", `Add a distracting ${nuisance}`, [{ property: nuisance, from: baseline, to: nuisanceColor }]);
    const cleanup = `c${nextId++}`;
    addCommit(cleanup, first, `Remove the distracting ${nuisance}`, [{ property: nuisance, from: nuisanceColor, to: baseline }]);
    const bundled = `c${nextId++}`;
    addCommit(bundled, cleanup, `Bundle the useful ${desiredSlot} change`, [
      { property: nuisance, from: baseline, to: nuisanceColor },
      { property: desiredSlot, from: "none", to: color },
    ]);
    branches[branch] = bundled;
    solutionCommands.push(`git merge ${branch}`, `git revert ${first}`);
    targetSnapshot[desiredSlot] = color;
  }

  const id = `daily-${date}`;
  const candidate: PuzzleCandidate = {
    schemaVersion: 2,
    themeId: "chicken-v1",
    id,
    version: 1,
    kind: "daily",
    slug: id,
    title: "Useful Work, Extra Baggage",
    description: "Bring useful accessories onto main and clean up each branch's nuisance change.",
    difficulty,
    publishedOn: date,
    objectives: ["Keep the useful accessories and remove the nuisance changes."],
    initialRepository: {
      commits,
      branches,
      currentBranch: "main",
      head: "c1",
      initialState: { ...EMPTY_CHICKEN_STATE, body: "cream" },
      nextGeneratedId: 1,
    },
    target: { branch: "main", snapshot: targetSnapshot },
    allowedCommands: [...SUPPORTED_ACTION_TYPES],
    hints: ["Each branch bundles an accessory with an unwanted change.", "Merge a branch to bring in both changes.", "Clean up its nuisance change while keeping the accessory."],
    solutionCommands,
  };
  const validation = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validation.ok) {
    throw new Error(`Bundled candidate failed validation: ${validation.issues.map((issue) => `${issue.code} at ${issue.path}`).join(", ")}`);
  }
  return {
    candidate,
    family: "bundled-nuisance-cleanup",
    signature: mechanicsSignature(candidate),
    generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
  };
}

/** Collision-free canonical mechanics, independent of cosmetic property/value labels and prose. */
export function mechanicsSignature(candidate: PuzzleCandidate): string {
  return JSON.stringify(mechanicsShape(candidate));
}

function validateInputs(date: string, difficulty: PuzzleDifficulty, seed: string, variant: number): void {
  if (!isCanonicalDate(date)) throw new Error("date must be a valid YYYY-MM-DD calendar date.");
  if (!(difficulty in MODULE_COUNTS)) throw new Error("difficulty must be easy, medium, or hard.");
  if (typeof seed !== "string" || seed.trim().length === 0 || seed.length > 256) throw new Error("seed must be a non-empty string of at most 256 characters.");
  if (!Number.isSafeInteger(variant) || variant < 0) throw new Error("variant must be a non-negative safe integer.");
}

function modulePattern(count: number, variant: number): ModuleKind[] {
  const pattern = variant % 4;
  if (pattern === 0) return Array.from({ length: count }, () => "dependency");
  if (pattern === 1) return Array.from({ length: count }, () => "repair");
  if (pattern === 2) return Array.from({ length: count }, (_, index) => index % 2 === 0 ? "dependency" : "repair");
  return Array.from({ length: count }, (_, index) => index % 2 === 0 ? "repair" : "dependency");
}

function selectSlots(count: number, random: () => number): ChickenAccessorySlot[] {
  const available = shuffled(SLOTS, random);
  const selected: ChickenAccessorySlot[] = [];
  for (const slot of available) {
    if ((slot === "hat" && selected.includes("crest")) || (slot === "crest" && selected.includes("hat"))) continue;
    selected.push(slot);
    if (selected.length === count) break;
  }
  return selected;
}

function familyForPattern(pattern: ModuleKind[]): string {
  const key = pattern.map((kind) => kind === "dependency" ? "d" : "r").join("");
  if (/^d+$/.test(key)) return "dependency-chain";
  if (/^r+$/.test(key)) return "repair-and-assemble";
  if (key.startsWith("d")) return "selective-transfer";
  return "prepare-integration";
}

function mechanicsShape(candidate: PuzzleCandidate): unknown {
  const ids = Object.keys(candidate.initialRepository.commits).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  const propertyIds = new Map<string, number>();
  const valuesByProperty = new Map<string, Map<string, number>>();
  const getPropertyId = (property: string) => {
    if (!propertyIds.has(property)) propertyIds.set(property, propertyIds.size);
    return propertyIds.get(property)!;
  };
  const getValueId = (property: string, value: unknown) => {
    const key = JSON.stringify(value);
    let values = valuesByProperty.get(property);
    if (!values) valuesByProperty.set(property, values = new Map());
    if (!values.has(key)) values.set(key, values.size);
    return values.get(key)!;
  };
  // Discover slots through mechanics rather than the theme's property ordering.
  for (const id of ids) for (const change of candidate.initialRepository.commits[id].changes) getPropertyId(change.property);
  for (const property of Object.keys(candidate.initialRepository.initialState)) getPropertyId(property);
  const state = (snapshot: Record<string, unknown>) => [...propertyIds.entries()]
    .sort(([, a], [, b]) => a - b)
    .map(([property, id]) => [id, getValueId(property, snapshot[property])]);
  const initialState = state(candidate.initialRepository.initialState);
  const commits = ids.map((id) => {
    const commit = candidate.initialRepository.commits[id];
    return {
      parents: commit.parents.map((parent) => ids.indexOf(parent)),
      changes: commit.changes.map((change) => [getPropertyId(change.property), getValueId(change.property, change.from), getValueId(change.property, change.to)]),
    };
  });
  const target = state(candidate.target.snapshot);
  return {
    // IDs are retained because merge-base tie breaking depends on them.
    ids,
    initialState,
    commits,
    currentBranch: candidate.initialRepository.currentBranch,
    head: candidate.initialRepository.head,
    nextGeneratedId: candidate.initialRepository.nextGeneratedId,
    mainHead: ids.indexOf(candidate.initialRepository.branches.main),
    sideHeads: Object.entries(candidate.initialRepository.branches).filter(([branch]) => branch !== "main").sort(([a], [b]) => a.localeCompare(b)).map(([branch, head]) => [branch, ids.indexOf(head)]),
    target,
  };
}

function isCanonicalDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
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

function hashString(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}
