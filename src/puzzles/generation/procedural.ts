import { executeCommand, getSnapshot, type Repository, type SemanticChange } from "../../engine";
import { isAncestor } from "../../engine/graph";
import { CHICKEN_V2_SEMANTIC_POLICY, EMPTY_CHICKEN_STATE } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate, PuzzleDifficulty } from "../types";
import { createTemplateLocalizations } from "./editorial";
import { dailySearchCommands, repositorySearchKey } from "./quality";
import { snapshotKey } from "./mechanicsState";
export { snapshotKey } from "./mechanicsState";

const PROPERTIES = ["body", "sunglasses", "scarf", "longLegs", "hat"];
const COLORS = ["red", "blue", "turquoise", "purple", "gold"];
const MINIMUM = { easy: 2, medium: 4, hard: 6 } as const;
export const PROCEDURAL_GENERATOR_VERSION = 1;

/** Experimental proposals, NOT a publication certificate. No fixed puzzle/solution templates. */
export function createProceduralRepository(seed: string, difficulty: PuzzleDifficulty): Repository {
  const random = rng(`${seed}|${difficulty}`);
  const commits: Repository["commits"] = {};
  const initialState = { ...EMPTY_CHICKEN_STATE, body: "cream" };
  const add = (parent: string | undefined, changes: SemanticChange[]) => {
    const id = `c${Object.keys(commits).length + 1}`;
    commits[id] = { id, parents: parent ? [parent] : [], message: "Repository change", changes, provenance: { type: "original", sourceCommits: [] } };
    return id;
  };
  const root = add(undefined, []);
  const forks = [root];
  const activeProperties = shuffled(PROPERTIES, random).slice(0, difficulty === "easy" ? 2 : difficulty === "medium" ? 3 + Math.floor(random() * 2) : 4 + Math.floor(random() * 2));
  // A small palette creates interacting edits, dependencies and actual reversals.
  const values = Object.fromEntries(activeProperties.map(property => [property,
    [initialState[property as keyof typeof initialState], ...shuffled(COLORS, random).slice(0, 2 + Math.floor(random() * 2))]]));
  const extend = (parent: string, count: number) => {
    let head = parent;
    for (let i = 0; i < count; i++) {
      const before = snapshotAt(commits, initialState, head);
      // Compose temporary edits with a useful bundled edit. Where these occur,
      // their dependencies and surrounding edits are sampled, not a fixed puzzle.
      // Integrating/squashing can cancel the temporary work; copying may require
      // its prerequisites. The oracle, not this construction, decides difficulty.
      if (count - i >= 3 && random() < 0.55) {
        const [temporary, useful] = shuffled(activeProperties, random);
        const [first, second] = shuffled(values[temporary].filter(value => value !== before[temporary]), random);
        const usefulValue = pick(values[useful].filter(value => value !== before[useful]), random);
        head = add(head, [{ type: "set", property: temporary, from: before[temporary], to: first }]);
        forks.push(head);
        head = add(head, [
          { type: "set", property: temporary, from: first, to: second },
          { type: "set", property: useful, from: before[useful], to: usefulValue },
        ]);
        forks.push(head);
        head = add(head, [{ type: "set", property: temporary, from: second, to: before[temporary] }]);
        forks.push(head);
        i += 2;
        continue;
      }
      const selected = shuffled(activeProperties, random).slice(0, random() < 0.4 ? 2 : 1);
      const changes = selected.map(property => ({ type: "set" as const, property, from: before[property],
        to: pick(values[property].filter(value => value !== before[property]), random) }));
      head = add(head, changes);
      forks.push(head);
    }
    return head;
  };
  const main = extend(root, 1 + Math.floor(random() * 2));
  const branches: Record<string, string> = { main };
  const sideCount = difficulty === "easy" ? 1 + Math.floor(random() * 2) : difficulty === "medium" ? 2 : 2 + Math.floor(random() * 2);
  for (let i = 0; i < sideCount; i++) {
    // Later branches can fork from earlier side branches, not only from main.
    const parent = pick(forks, random);
    const length = difficulty === "easy" ? 1 + Math.floor(random() * 2) : 2 + Math.floor(random() * (difficulty === "hard" ? 4 : 3));
    branches[["feature", "polish", "release"][i]] = extend(parent, length);
  }
  return { commits, branches, currentBranch: "main", head: main, initialState, nextGeneratedId: 1 };
}

/** Reach targets by legal play first. A separate exhaustive oracle must reject shortcuts. */
export function proposeProceduralCandidates(date: string, difficulty: PuzzleDifficulty, seed: string, walks = 48): PuzzleCandidate[] {
  const repository = createProceduralRepository(seed, difficulty);
  const initial = snapshotKey(getSnapshot(repository));
  const proposals = new Map<string, PuzzleCandidate>();
  const length = MINIMUM[difficulty];
  for (let walkIndex = 0; walkIndex < walks; walkIndex++) {
    const random = rng(`${seed}|walk|${walkIndex}`);
    let repo = repository;
    const path: string[] = [];
    const visited = new Set([repositorySearchKey(repo)]);
    for (let step = 0; step < length; step++) {
      const choices = dailySearchCommands(repo, 64).commands.flatMap(command => {
        if (command.length > 160) return [];
        if (command.startsWith("git switch") && path.at(-1)?.startsWith("git switch")) return [];
        const result = executeCommand(repo, command);
        if (!result.ok || !result.mutated || visited.has(repositorySearchKey(result.repository))) return [];
        // Prefer teachable routes: undo work actually in this branch's history.
        // The certification oracle still explores EVERY legal revert for shortcuts.
        if (result.action.type === "revert" && !isAncestor(repo, result.action.commit, repo.head)) return [];
        if (step === length - 1 && result.repository.currentBranch !== "main") return [];
        // Do not fill the walk with empty cherry-picks, merges or rebases.
        const changed = snapshotKey(getSnapshot(repo)) !== snapshotKey(getSnapshot(result.repository));
        if (!changed && result.action.type !== "switch" && !(command.includes("squash") && result.action.type === "interactive-rebase")) return [];
        // Different exploration biases expose branch preparation and squash as
        // well as direct integration. None prescribe a command sequence.
        if (walkIndex % 4 === 0 && result.action.type === "cherry-pick") return [];
        const weight = result.action.type === "merge" ? 4 : result.action.type === "revert" ? 3 : result.action.type === "switch" ? (walkIndex % 4 === 1 ? 5 : 1) : 2;
        return [{ command, result, rank: -Math.log(Math.max(random(), Number.EPSILON)) / weight }];
      }).sort((a, b) => a.rank - b.rank);
      if (!choices.length) break;
      const { command, result } = choices[0];
      path.push(command);
      repo = result.repository;
      visited.add(repositorySearchKey(repo));
    }
    if (path.length !== length || repo.currentBranch !== "main") continue;
    const target = getSnapshot(repo, repo.branches.main);
    const key = snapshotKey(target);
    if (key === initial) continue;
    if (difficulty !== "easy" && !path.some(command => /^git (merge|rebase)/.test(command))) continue;
    if (proposals.has(key)) continue;
    const candidate: PuzzleCandidate = {
      schemaVersion: 2, themeId: "chicken-v1", id: `daily-${date}`, version: 1, kind: "daily",
      slug: `daily-${date}`, title: "Repository Workshop", description: "Make main match the illustrated target.", difficulty, publishedOn: date,
      objectives: ["Make main match the illustrated target."], initialRepository: repository, target: { branch: "main", snapshot: target },
      allowedCommands: ["switch", "log", "merge", "cherry-pick", "revert", "rebase", "interactive-rebase"],
      hints: ["Compare the branches and the illustrated target."], solutionCommands: path,
    };
    const localizations = createTemplateLocalizations(candidate, "procedural", seed);
    const localized = { ...candidate, ...localizations.en, localizations,
      initialRepository: { ...repository, commits: Object.fromEntries(Object.entries(repository.commits).map(([id, commit]) => [id, { ...commit, message: localizations.en.commitMessages[id] }])) } };
    // commitMessages belongs inside localizations, not the public candidate schema.
    const { commitMessages: _messages, ...finalCandidate } = localized;
    const validation = validatePuzzleCandidate(finalCandidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    if (validation.ok && validation.value.puzzle.parCommands === length) proposals.set(key, finalCandidate);
  }
  return [...proposals.values()];
}

export function proposeProceduralCandidate(date: string, difficulty: PuzzleDifficulty, seed: string, walkIndex = 0): PuzzleCandidate | undefined {
  return proposeProceduralCandidates(date, difficulty, `${seed}|${walkIndex}`, 8)[0];
}

function snapshotAt(commits: Repository["commits"], initialState: Repository["initialState"], id: string) {
  return getSnapshot({ commits, branches: { main: id }, currentBranch: "main", head: id, initialState, nextGeneratedId: 1 }, id);
}
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function pick<T>(items: readonly T[], random: () => number): T { return items[Math.floor(random() * items.length)]; }
function rng(text: string) {
  let x = 2166136261;
  for (const char of text) x = Math.imul(x ^ char.charCodeAt(0), 16777619);
  return () => { x = (x + 0x6d2b79f5) | 0; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
