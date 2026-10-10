import { describe, expect, it } from "vitest";
import { CHICKEN_ACCESSORY_SLOTS } from "../chickenTheme";
import { createGenerationBrief, GENERATION_PROFILES } from "./brief";
import { validateCandidateAgainstBrief } from "./validateBrief";
import type { GenerationBrief } from "./types";

describe("daily generation briefs", () => {
  it("is deterministic for a persisted date, difficulty, and seed", () => {
    const first = createGenerationBrief("2026-10-09", "hard", "fixed-seed");
    const second = createGenerationBrief("2026-10-09", "hard", "fixed-seed");
    expect(first).toEqual(second);
  });

  it("varies briefs while respecting every difficulty profile", () => {
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const profile = GENERATION_PROFILES[difficulty];
      const signatures = new Set<string>();
      for (let index = 0; index < 30; index += 1) {
        const brief = createGenerationBrief("2026-10-09", difficulty, `seed-${index}`);
        expect(brief.branchCount).toBeGreaterThanOrEqual(profile.branches[0]);
        expect(brief.branchCount).toBeLessThanOrEqual(profile.branches[1]);
        expect(brief.commitCount).toBeGreaterThanOrEqual(profile.commits[0]);
        expect(brief.commitCount).toBeLessThanOrEqual(profile.commits[1]);
        const accessoryCount = CHICKEN_ACCESSORY_SLOTS.filter((slot) => brief.targetState[slot] !== "none").length;
        expect(accessoryCount).toBeGreaterThanOrEqual(profile.accessories[0]);
        expect(accessoryCount).toBeLessThanOrEqual(profile.accessories[1]);
        const concepts = new Set(brief.requiredConcepts);
        if (brief.graphArchetype === "fast-forward") expect(concepts.has("merge") || concepts.has("ff-only")).toBe(true);
        if (brief.graphArchetype === "divergent-merge") expect(concepts).toEqual(new Set(["switch", "merge"]));
        if (brief.graphArchetype === "curate-and-undo") {
          expect(concepts.has("revert")).toBe(true);
          expect(concepts.has("merge") || concepts.has("cherry-pick")).toBe(true);
        }
        if (brief.graphArchetype === "multi-branch-curation") expect(brief.requiredConcepts).toHaveLength(3);
        signatures.add(JSON.stringify([brief.targetState, brief.storyTheme, brief.graphArchetype]));
      }
      expect(signatures.size).toBeGreaterThan(5);
    }
  });
});

describe("brief-specific validation", () => {
  const date = "2026-10-09";
  const candidate = {
    schemaVersion: 2, themeId: "chicken-v1", id: `daily-${date}`, version: 1, kind: "daily", slug: `daily-${date}`, publishedOn: date,
    difficulty: "easy", title: "Beach transfer", description: "A beach holiday needs one scarf.", objectives: ["Copy the useful work."],
    initialRepository: {
      initialState: { sunglasses: "none", hat: "none", scarf: "none", crest: "none", longLegs: "none" }, currentBranch: "main", head: "c2", nextGeneratedId: 1,
      branches: { main: "c2", feature: "c3" },
      commits: {
        c1: { id: "c1", parents: [], message: "Start", changes: [], provenance: { type: "original", sourceCommits: [] } },
        c2: { id: "c2", parents: ["c1"], message: "Prepare", changes: [], provenance: { type: "original", sourceCommits: [] } },
        c3: { id: "c3", parents: ["c1"], message: "Add scarf", changes: [{ type: "set", property: "scarf", from: "none", to: "turquoise" }], provenance: { type: "original", sourceCommits: [] } },
      },
    },
    target: { branch: "main", snapshot: { sunglasses: "none", hat: "none", scarf: "turquoise", crest: "none", longLegs: "none" }, branchHeads: {}, requiredProvenance: [] },
    allowedCommands: ["log", "switch", "cherry-pick"], hints: ["Inspect.", "Copy."], solutionCommands: ["git cherry-pick c3"],
  };
  const brief: GenerationBrief = {
    date,
    seed: "fixture",
    briefVersion: 2,
    promptVersion: 2,
    difficulty: "easy",
    branchCount: 2,
    commitCount: 3,
    graphArchetype: "single-transfer",
    targetState: candidate.target.snapshot as GenerationBrief["targetState"],
    requiredConcepts: ["cherry-pick"],
    allowedCommands: ["log", "switch", "cherry-pick"],
    solutionLength: { min: 1, max: 3 },
    hintCount: 2,
    storyTheme: "beach holiday",
  };

  it("accepts a candidate that exactly satisfies its persisted brief", () => {
    expect(validateCandidateAgainstBrief(candidate, brief)).toEqual({ ok: true, issues: [] });
  });

  it("rejects target-state drift even when the generic puzzle remains valid", () => {
    const changedBrief = { ...brief, targetState: { ...brief.targetState, hat: "gold" as const } };
    const result = validateCandidateAgainstBrief(candidate, changedBrief);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "brief.target-state")).toBe(true);
  });

  it("rejects a repository that does not match the requested graph archetype", () => {
    const changedBrief: GenerationBrief = {
      ...brief,
      graphArchetype: "fast-forward",
      requiredConcepts: ["cherry-pick"],
    };
    const result = validateCandidateAgainstBrief(candidate, changedBrief);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "brief.graph-archetype")).toBe(true);
  });

  it("rejects daily-only immutable graph and brief drift", () => {
    const drift = structuredClone(candidate) as Record<string, any>;
    drift.initialRepository.branches = { main: "c2", style: "c3" };
    drift.allowedCommands = ["switch", "cherry-pick"];
    drift.hints = ["Only one."];
    drift.description = "A generic story.";
    const result = validateCandidateAgainstBrief(drift, brief);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("brief.branch-set");
    expect(codes).toContain("brief.allowed-commands");
    expect(codes).toContain("brief.hint-count");
    expect(codes).toContain("brief.story-theme");
  });
});
