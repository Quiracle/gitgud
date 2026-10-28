import { describe, expect, it } from "vitest";
import { executeCommand, getSnapshot } from "../../engine";
import { createTemplateCandidate } from "./templates";
import { discoverProof } from "./synthesis";

describe("constructive proof discovery", () => {
  it.each(["medium-5", "medium-6", "hard-6"])("finds a real route through the %s positive control", id => {
    const { candidate } = createTemplateCandidate(id, "2030-01-01", "discovery");
    const result = discoverProof(candidate.initialRepository, candidate.target, { maxCommands: id.startsWith("hard") ? 6 : 4, maxElapsedMs: 20_000, maxTransitions: 100_000 });
    expect(result.status).toBe("found");
    let repository = candidate.initialRepository;
    for (const command of result.commands ?? []) {
      const step = executeCommand(repository, command);
      expect(step.ok).toBe(true);
      if (step.ok) repository = step.repository;
    }
    expect(repository.currentBranch).toBe("main");
    expect(getSnapshot(repository)).toEqual(candidate.target.snapshot);
  }, 25_000);

  it("treats exhausted discovery as inconclusive", () => {
    const { candidate } = createTemplateCandidate("hard-6", "2030-01-01", "budget");
    expect(discoverProof(candidate.initialRepository, candidate.target, { maxCommands: 6, maxTransitions: 1 }).status).toBe("budget-exhausted");
  });
});
