import { beforeAll, describe, expect, it } from "vitest";
import { createTemplateCandidate } from "./templates";
import { createCandidateArtifact, verifyCandidateArtifact } from "./candidateArtifact";

const trustedFingerprint = "a".repeat(64);

beforeAll(() => {
  if (!globalThis.crypto?.subtle) throw new Error("Tests require Web Crypto; run with NODE_OPTIONS=--experimental-global-webcrypto.");
});

async function fixture() {
  const candidate = createTemplateCandidate("medium-6", "2026-10-01", "private-artifact-fixture").candidate;
  return createCandidateArtifact({ candidate, status: "certified" }, {
    sourceFingerprint: trustedFingerprint,
    excludedThroughDepth: 3,
  });
}

describe("private procedural candidate artifacts", () => {
  it("binds mechanics and proof while allowing publication date and story rebinding", async () => {
    const artifact = await fixture();
    expect(artifact.id).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.certificate.mechanicsDigest).toBe(artifact.id);
    expect(artifact.certificate.proofCommands).toBe(artifact.candidate.solutionCommands.length);
    expect(artifact.candidate.solutionCommands.length).toBeGreaterThan(0);

    const rebound = structuredClone(artifact);
    rebound.candidate.id = "daily-2026-10-02";
    rebound.candidate.slug = "daily-2026-10-02";
    rebound.candidate.publishedOn = "2026-10-02";
    rebound.candidate.title = "A newly localized story title";
    rebound.candidate.description = "A newly localized story description.";
    rebound.candidate.initialRepository.commits.c1.message = "Updated editorial commit text";
    await expect(verifyCandidateArtifact(rebound, { sourceFingerprint: trustedFingerprint })).resolves.toBe(rebound);
  });

  it("rejects graph, proof, difficulty, certificate, and source tampering", async () => {
    const artifact = await fixture();
    const graphTamper = structuredClone(artifact);
    const commit = Object.values(graphTamper.candidate.initialRepository.commits).find(item => item.changes.length > 0)!;
    (commit.changes[0] as { to: unknown }).to = "gold";
    await expect(verifyCandidateArtifact(graphTamper, { sourceFingerprint: trustedFingerprint })).rejects.toThrow();

    const proofTamper = structuredClone(artifact);
    proofTamper.candidate.solutionCommands[0] = "git push";
    await expect(verifyCandidateArtifact(proofTamper, { sourceFingerprint: trustedFingerprint })).rejects.toThrow();

    const difficultyTamper = structuredClone(artifact);
    difficultyTamper.candidate.difficulty = "easy";
    await expect(verifyCandidateArtifact(difficultyTamper, { sourceFingerprint: trustedFingerprint })).rejects.toThrow();

    const certificateTamper = structuredClone(artifact);
    certificateTamper.certificate.excludedThroughDepth = 2;
    await expect(verifyCandidateArtifact(certificateTamper, { sourceFingerprint: trustedFingerprint })).rejects.toThrow();

    await expect(verifyCandidateArtifact(artifact, { sourceFingerprint: "b".repeat(64) })).rejects.toThrow(/not trusted/);
  });

  it("requires a certified verdict and canonical JSON sorts object keys recursively", async () => {
    const candidate = createTemplateCandidate("medium-6", "2026-10-01", "private-artifact-fixture").candidate;
    await expect(createCandidateArtifact({ candidate, status: "unknown" }, {
      sourceFingerprint: trustedFingerprint, excludedThroughDepth: 3,
    })).rejects.toThrow(/certified/);
    await expect(createCandidateArtifact({ candidate, status: "certified" }, {
      sourceFingerprint: trustedFingerprint, excludedThroughDepth: 0,
    })).rejects.toThrow(/exclusion/);
    const { canonicalJson } = await import("./candidateArtifact");
    expect(canonicalJson({ z: { y: 2, x: 1 }, a: [2, { z: true, b: false }] })).toBe('{"a":[2,{"b":false,"z":true}],"z":{"x":1,"y":2}}');
  });

  it("permits short copy exercises at easy difficulty", async () => {
    const candidate = createTemplateCandidate("easy-0", "2030-01-01", "easy").candidate;
    const artifact = await createCandidateArtifact({ candidate, status: "certified" }, { sourceFingerprint: trustedFingerprint, excludedThroughDepth: 1 });
    await expect(verifyCandidateArtifact(artifact, { sourceFingerprint: trustedFingerprint })).resolves.toEqual(artifact);
  });

  it("accepts a longer hard proof without claiming it is the shortest solution", async () => {
    const candidate = createTemplateCandidate("hard-6", "2030-01-01", "longer-proof").candidate;
    candidate.solutionCommands.splice(1, 1, "git switch feature", "git rebase main", "git switch main", "git merge feature");
    const artifact = await createCandidateArtifact({ candidate, status: "certified" }, { sourceFingerprint: trustedFingerprint, excludedThroughDepth: 5 });
    expect(artifact.certificate).toMatchObject({ minimumCommands: 6, excludedThroughDepth: 5, proofCommands: 9, copyOnlyExcludedThroughDepth: 9 });
    await expect(verifyCandidateArtifact(artifact, { sourceFingerprint: trustedFingerprint })).resolves.toEqual(artifact);
  });
});

