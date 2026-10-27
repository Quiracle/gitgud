import { describe, expect, it, vi } from "vitest";
import { createTemplateCandidate } from "./templates";
import { searchDailyPuzzle } from "./quality";
import { proposeProceduralCandidates } from "./procedural";
import { certifyProceduralBatch } from "./proceduralCertification";
import { findCopyOnlySolution } from "./proceduralQuality";
import { createDeterministicCandidate } from "./deterministic";

describe("procedural certification", () => {
  it("matches the single-target oracle, including rejecting padded walks", () => {
    const candidates = proposeProceduralCandidates("2030-01-01", "medium", "procedural-research-20", 64);
    const batch = certifyProceduralBatch(candidates, { maxDepth: 3 });
    expect(batch.verdicts.length).toBeGreaterThan(0);
    expect(batch.verdicts.some(v => v.status === "shortcut")).toBe(true);
    for (const verdict of batch.verdicts) {
      const search = searchDailyPuzzle(verdict.candidate, { maxDepth: 3 });
      expect(verdict.status).toBe(search.status === "exhausted" ? "certified" : "shortcut");
      if (verdict.shortcut) expect(verdict.shortcut.length).toBe(search.shortestCommands?.length);
    }
    const workshop = createTemplateCandidate("medium-6", "2030-01-01", "positive-control").candidate;
    const certified = certifyProceduralBatch([workshop], { maxDepth: 3 });
    expect(certified.verdicts[0].status).toBe("certified");
    expect(certified.excludedThroughDepth).toBe(3);
  });

  it("never certifies after exhausting its budget or for a different graph", () => {
    const hard = createTemplateCandidate("hard-6", "2030-01-01", "budget").candidate;
    expect(certifyProceduralBatch([hard], { maxDepth: 5, maxTransitions: 1 }).verdicts[0].status).toBe("unknown");
    const other = structuredClone(hard);
    other.initialRepository.nextGeneratedId++;
    expect(() => certifyProceduralBatch([hard, other], { maxDepth: 5 })).toThrow(/share/);
    expect(() => certifyProceduralBatch([hard], { maxDepth: 4 })).toThrow(/proof/);
    const clock = vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValue(2);
    try {
      expect(certifyProceduralBatch([hard], { maxDepth: 5, maxElapsedMs: 1 }).verdicts[0].status).toBe("unknown");
    } finally { clock.mockRestore(); }
  });

  it("detects copy-chain solutions without imposing command restrictions on the player", () => {
    const chain = createDeterministicCandidate("2030-01-01", "medium", "copy", 0).candidate;
    expect(findCopyOnlySolution(chain)?.length).toBeLessThanOrEqual(4);
    const workshop = createTemplateCandidate("hard-6", "2030-01-01", "workshop").candidate;
    expect(findCopyOnlySolution(workshop, 6)).toBeUndefined();
    expect(workshop.allowedCommands).toContain("cherry-pick");
  });
});
