import { getSnapshot, type PuzzleTarget, type Repository, type SemanticChange } from "../../engine";
import { EMPTY_CHICKEN_STATE } from "../chickenTheme";
import type { PuzzleDifficulty } from "../types";

const PROPERTIES = ["body", "sunglasses", "scarf", "longLegs", "hat"] as const;
type Property = (typeof PROPERTIES)[number];
const COLORS = ["red", "blue", "turquoise", "purple", "gold"] as const;
const BRANCHES = ["feature", "polish", "release"] as const;

/** Seeded graph/target proposal only. It deliberately creates no solution proof or certificate. */
export function createConstructiveProblem(seed: string, difficulty: PuzzleDifficulty): { repository: Repository; target: PuzzleTarget; branchBases: Record<string, string> } {
  if (!["easy", "medium", "hard"].includes(difficulty)) throw new Error("Unsupported constructive difficulty.");
  const random = rng(`${seed}|${difficulty}`);
  const initialState = { ...EMPTY_CHICKEN_STATE, body: "cream" };
  const commits: Repository["commits"] = {};
  const add = (parent: string | undefined, changes: SemanticChange[]) => {
    if (Object.keys(commits).length >= 25) throw new Error("Constructive graph exceeded its commit bound.");
    const id = `c${Object.keys(commits).length + 1}`;
    commits[id] = { id, parents: parent ? [parent] : [], message: "Repository change", changes, provenance: { type: "original", sourceCommits: [] } };
    return id;
  };
  const root = add(undefined, []);
  let main = root;
  const guards = shuffled([...PROPERTIES], random).slice(0, 2);
  const guardColors = shuffled([...COLORS], random);
  // Usually one bundled commit; sometimes separate commits make main's history less uniform.
  const guardChanges = guards.map((property, index) => change(property, initialState[property], guardColors[index]));
  if (random() < 0.72) main = add(main, guardChanges);
  else {
    main = add(main, [guardChanges[0]]);
    main = add(main, [guardChanges[1]]);
  }
  const usefulCount = difficulty === "hard" && random() < 0.35 ? 3 : difficulty === "hard" ? 2 : 1;
  const useful = shuffled(PROPERTIES.filter(p => !guards.includes(p)), random).slice(0, usefulCount);
  const branches: Record<string, string> = { main };
  const includeBaseBranch = random() < 0.5;
  if (includeBaseBranch) branches.base = root;
  const forkPool: string[] = [root, ...Object.keys(commits).filter(id => id !== root)];
  const branchBases: Record<string, string> = {};
  const targetState: Record<string, unknown> = { ...getSnapshot({ commits, branches: { main }, currentBranch: "main", head: main, initialState, nextGeneratedId: 1 }) };
  const usefulGoals = Object.fromEntries(useful.map(property => [property, pick(COLORS, random)]));
  Object.assign(targetState, usefulGoals);
  useful.forEach((property, index) => {
    const branchName = BRANCHES[index];
    // Keep root and main forks common even as the pool grows; otherwise later
    // commits would dominate and deeply nest each new feature branch.
    const roll = random();
    const earlierForks = forkPool.filter(id => id !== root && id !== main).filter(id => {
      const state = getSnapshot(repository(commits, initialState, branches, id));
      // Share setup or incomplete work, not an already finished earlier task.
      return useful.slice(0, index).every(previous => state[previous] !== usefulGoals[previous]);
    });
    const base = roll < 0.4 ? root
      : roll < 0.6 ? main
        : earlierForks.length ? pick(earlierForks, random) : pick([root, main], random);
    branchBases[branchName] = base;
    let head = base;
    const transient = random() < 0.75 ? pick(guards, random) : pick(PROPERTIES.filter(p => p !== property), random);
    const desired = usefulGoals[property];
    const otherUseful = useful.filter(candidate => candidate !== property);
    const coupledTail = difficulty !== "easy" && random() < 0.3;
    const nuisanceChoices = coupledTail ? PROPERTIES.filter(p => p !== transient && p !== property) : guards;
    const nuisanceProperty = coupledTail ? pick(nuisanceChoices, random)
      : random() < 0.65 || otherUseful.length === 0 ? pick(guards, random) : pick(otherUseful, random);
    const nuisanceFrom = getSnapshot(repository(commits, initialState, branches, head))[nuisanceProperty];
    const nuisanceTo = pick(COLORS.filter(value => value !== nuisanceFrom && value !== targetState[nuisanceProperty]), random);
    const bundlePosition = Math.floor(random() * 3); // useful work joins the first, middle, or restoration step
    const nuisanceFirst = !coupledTail && random() < 0.5;
    if (nuisanceFirst) head = add(head, [change(nuisanceProperty, nuisanceFrom, nuisanceTo)]);
    // The nuisance edit may target this transient slot, so derive its path only
    // after that optional edit has actually been applied.
    const transientBase = getSnapshot(repository(commits, initialState, branches, head))[transient];
    const [first, second] = shuffled(COLORS.filter(value => value !== transientBase && value !== targetState[transient]), random);
    const firstChanges = [change(transient, transientBase, first)];
    if (bundlePosition === 0) firstChanges.push(change(property, getSnapshot(repository(commits, initialState, branches, head))[property], desired));
    head = add(head, firstChanges);
    const middleChanges = [change(transient, first, second)];
    if (bundlePosition === 1) middleChanges.push(change(property, getSnapshot(repository(commits, initialState, branches, head))[property], desired));
    head = add(head, middleChanges);
    const beforeRestore = getSnapshot(repository(commits, initialState, branches, head));
    const finalChanges = [change(transient, beforeRestore[transient], transientBase)];
    if (bundlePosition === 2) finalChanges.push(change(property, beforeRestore[property], desired));
    head = add(head, finalChanges);
    if (coupledTail) {
      // A two-step contaminated tail cannot be cleaned by reverting one commit.
      // It makes extracting a clean squashed prefix a meaningful option.
      branches.base = root;
      const beforeTail = getSnapshot(repository(commits, initialState, branches, head));
      const [tailFirst, tailSecond] = shuffled(COLORS.filter(value => value !== beforeTail[transient] && value !== targetState[transient]), random);
      const bad = pick(COLORS.filter(value => value !== beforeTail[nuisanceProperty] && value !== targetState[nuisanceProperty]), random);
      head = add(head, [change(transient, beforeTail[transient], tailFirst), change(nuisanceProperty, beforeTail[nuisanceProperty], bad)]);
      head = add(head, [change(transient, tailFirst, tailSecond)]);
    } else if (!nuisanceFirst) {
      const current = getSnapshot(repository(commits, initialState, branches, head))[nuisanceProperty];
      head = add(head, [change(nuisanceProperty, current, pick(COLORS.filter(value => value !== current && value !== targetState[nuisanceProperty]), random))]);
    }
    branches[branchName] = head;
    // Later branches can fork from any interior point, not only this tip.
    for (const id of Object.keys(commits)) if (!forkPool.includes(id)) forkPool.push(id);
    targetState[property] = desired;
  });
  const finalRepository = repository(commits, initialState, branches, main);
  return { repository: finalRepository, target: { branch: "main", snapshot: targetState }, branchBases };
}

function repository(commits: Repository["commits"], initialState: Repository["initialState"], branches: Record<string, string>, head: string): Repository {
  return { commits, branches: { ...branches, ...(branches.main ? {} : { main: head }) }, currentBranch: "main", head, initialState, nextGeneratedId: 1 };
}
function change(property: Property, from: unknown, to: unknown): SemanticChange {
  if (from === to) throw new Error("Constructive generator attempted a no-op change.");
  return { type: "set", property, from, to };
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
