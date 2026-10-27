import { describe, expect, it } from "vitest";
import { createTemplateCandidate } from "./templates";
import { fingerprintMechanics } from "./novelty";
import { fingerprintDecisionCore } from "./decisionCore";

describe("decision core novelty", () => {
  it("does not count unused branches or independent canceled decoration as new reasoning", () => {
    const candidate = createTemplateCandidate("medium-6", "2030-01-01", "core").candidate;
    const decorated = structuredClone(candidate);
    const repo = decorated.initialRepository;
    const property = ["hat", "scarf", "longLegs"].find(p => !Object.values(repo.commits).some(c => c.changes.some(change => change.property === p)))!;
    const head = repo.branches.feature;
    repo.commits.noiseA = { id: "noiseA", parents: [head], message: "Noise", changes: [{ type: "set", property, from: "none", to: "gold" }] };
    repo.commits.noiseB = { id: "noiseB", parents: ["noiseA"], message: "Undo noise", changes: [{ type: "set", property, from: "gold", to: "none" }] };
    repo.branches.feature = "noiseB";
    repo.commits.distractor = { id: "distractor", parents: ["c1"], message: "Unrelated", changes: [{ type: "set", property, from: "none", to: "blue" }] };
    repo.branches.distraction = "distractor";
    expect(fingerprintMechanics(repo, decorated.target).canonical).not.toBe(fingerprintMechanics(candidate.initialRepository, candidate.target).canonical);
    expect(fingerprintDecisionCore(decorated)).toBe(fingerprintDecisionCore(candidate));
  });

  it("does not count reordering independent integration tasks as novelty", () => {
    const first = createTemplateCandidate("hard-6", "2030-01-01", "order").candidate;
    const second = { ...first, solutionCommands: ["git revert c2", "git merge polish", "git revert c10", "git merge feature", "git revert c6", "git revert g1"] };
    expect(fingerprintDecisionCore(first)).toBe(fingerprintDecisionCore(second));
  });

  it("retains interacting bundled prerequisites in the core", () => {
    const workshop = createTemplateCandidate("medium-6", "2030-01-01", "core").candidate;
    const integration = createTemplateCandidate("medium-5", "2030-01-01", "core").candidate;
    expect(fingerprintDecisionCore(workshop)).not.toBe(fingerprintDecisionCore(integration));
  });
});
