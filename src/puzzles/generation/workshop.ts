import { CHICKEN_V2_SEMANTIC_POLICY, EMPTY_CHICKEN_STATE } from "../chickenTheme";
import { validatePuzzleCandidate } from "../validateCandidate";
import type { PuzzleCandidate } from "../types";
import { DETERMINISTIC_GENERATOR_VERSION, mechanicsSignature, SUPPORTED_ACTION_TYPES } from "./deterministic";

/** Work arrives in bundles: temporarily clear the integration boundary, then restore it. */
export function createWorkshopCandidate(date: string, difficulty: "medium" | "hard", seed: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Invalid workshop date.");
  if (difficulty !== "medium" && difficulty !== "hard") throw new Error("Invalid workshop difficulty.");
  if (typeof seed !== "string" || !seed.trim() || seed.length > 256) throw new Error("Invalid workshop seed.");
  let random = 2166136261;
  for (const char of `${date}|${seed}`) random = Math.imul(random ^ char.charCodeAt(0), 16777619);
  const colors = ["red", "blue", "turquoise", "purple", "gold"];
  const slots = (random >>> 0) % 2 ? ["scarf", "longLegs"] : ["longLegs", "scarf"];
  const desiredColors = [colors[(random >>> 0) % colors.length], colors[(random >>> 3) % colors.length]];
  const commits: PuzzleCandidate["initialRepository"]["commits"] = {};
  const add = (id: string, parent: string | undefined, edits: Array<[string, string, string]>) => {
    commits[id] = { id, parents: parent ? [parent] : [], message: id,
      changes: edits.map(([property, from, to]) => ({ type: "set", property, from, to })),
      provenance: { type: "original", sourceCommits: [] } };
  };
  add("c1", undefined, []);
  add("c2", "c1", [["body", "cream", "black"], ["sunglasses", "none", "blue"]]);
  const branches: Record<string, string> = { main: "c2", base: "c1" };
  const target = { ...EMPTY_CHICKEN_STATE, body: "black", sunglasses: "blue" } as Record<string, string>;
  const solutionCommands = ["git revert c2"];
  for (let index = 0; index < (difficulty === "hard" ? 2 : 1); index += 1) {
    const first = 3 + index * 4;
    const branch = index ? "polish" : "feature";
    const temporary = index ? "purple" : "red";
    const intermediate = index ? "turquoise" : "gold";
    const nuisance = index ? "gold" : "red";
    add(`c${first}`, "c1", [["body", "cream", temporary]]);
    // The useful edit cannot be copied alone onto black: it belongs to a bundled change.
    add(`c${first + 1}`, `c${first}`, [["body", temporary, intermediate], [slots[index], "none", desiredColors[index]]]);
    add(`c${first + 2}`, `c${first + 1}`, [["body", intermediate, "cream"]]);
    add(`c${first + 3}`, `c${first + 2}`, [["sunglasses", "none", nuisance]]);
    branches[branch] = `c${first + 3}`;
    target[slots[index]] = desiredColors[index];
    solutionCommands.push(`git merge ${branch}`, `git revert c${first + 3}`);
  }
  solutionCommands.push("git revert g1");
  const id = `daily-${date}`;
  const candidate: PuzzleCandidate = {
    schemaVersion: 2, themeId: "chicken-v1", id, slug: id, version: 1, kind: "daily", difficulty, publishedOn: date,
    title: "A Clean Workshop", description: "Bring the finished work together and preserve the original finishing touches.",
    objectives: ["Match the illustrated target on main."],
    hints: ["Some useful work is bundled with temporary changes.", "A correct change may need to be temporarily undone before integration.", "Restore the finishing touches after the branches are clean."],
    initialRepository: { commits, branches, currentBranch: "main", head: "c2", initialState: { ...EMPTY_CHICKEN_STATE, body: "cream" }, nextGeneratedId: 1 },
    target: { branch: "main", snapshot: target }, allowedCommands: [...SUPPORTED_ACTION_TYPES], solutionCommands,
  };
  const validated = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
  if (!validated.ok) throw new Error(`Invalid workshop candidate: ${validated.issues.map(i => i.code).join(", ")}`);
  return { candidate, family: "clean-room-integration", signature: mechanicsSignature(candidate), generatorVersion: DETERMINISTIC_GENERATOR_VERSION };
}
