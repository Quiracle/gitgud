import { describe, expect, it } from "vitest";
import { executeCommand } from "../../engine";
import { validatePuzzleCompletion } from "../completion";
import type { PuzzleDifficulty } from "../types";
import certificateDocument from "./certificates.json";
import { createCertifiedDaily, selectDailyTemplate, type RecentMechanics } from "./certified";

const certificates = certificateDocument.certificates as Array<{
  templateId: string;
  difficulty: PuzzleDifficulty;
  family: string;
  signature: string;
  minimumCommands: number;
  search: { status: string; excludedThroughDepth: number };
}>;

function dateFor(index: number) {
  return new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
}

describe("certified daily mechanics registry", () => {
  it("instantiates every registered template reproducibly across varied seeds and dates", () => {
    expect(certificates).toHaveLength(14);
    for (const certificate of certificates) {
      let referenceSignature: string | undefined;
      for (let index = 0; index < 25; index += 1) {
        const date = dateFor(index);
        const seed = `certification-seed-${certificate.templateId}-${index * 31 + 7}`;
        const generated = createCertifiedDaily(date, certificate.difficulty, seed, certificate.templateId);
        referenceSignature ??= generated.signature;
        expect(generated.signature, `${certificate.templateId}, sample ${index}`).toBe(referenceSignature);
        expect(generated.signature).toBe(certificate.signature);
        expect(generated.candidate.publishedOn).toBe(date);

        let repository = generated.candidate.initialRepository;
        for (const command of generated.candidate.solutionCommands) {
          const step = executeCommand(repository, command);
          expect(step.ok, `${certificate.templateId}, ${date}, ${command}${step.ok ? "" : `: ${step.output.join(" ")}`}`).toBe(true);
          if (!step.ok) break;
          repository = step.repository;
        }
        expect(validatePuzzleCompletion(generated.candidate, repository, []).solved, `${certificate.templateId}, ${date} proof`).toBe(true);
      }
    }
  });

  it("prefers a certified family and signature not present in recent mechanics", () => {
    const easy = certificates.filter((entry) => entry.difficulty === "easy");
    const unseen = easy.find((entry) => entry.family === "bundled-nuisance-cleanup")!;
    const recent: RecentMechanics[] = Array.from({ length: 14 }, (_, index) => {
      const alternatives = easy.filter((entry) => entry.templateId !== unseen.templateId);
      const previous = alternatives[index % alternatives.length];
      return { signature: previous.signature, family: previous.family };
    });
    const selected = selectDailyTemplate("easy", "any-seed", recent);
    const selectedCertificate = easy.find((entry) => entry.templateId === selected)!;
    expect(selectedCertificate.family).toBe(unseen.family);
    expect(recent.some((entry) => entry.signature === selectedCertificate.signature)).toBe(false);
  });

  it("selects deterministically for a fixed seed and gives different seeds a stable seeded ranking", () => {
    const first = selectDailyTemplate("medium", "seed-alpha", []);
    const second = selectDailyTemplate("medium", "seed-beta", []);
    expect(selectDailyTemplate("medium", "seed-alpha", [])).toBe(first);
    expect(selectDailyTemplate("medium", "seed-beta", [])).toBe(second);
    expect(certificates.some((entry) => entry.templateId === first && entry.difficulty === "medium")).toBe(true);
    expect(certificates.some((entry) => entry.templateId === second && entry.difficulty === "medium")).toBe(true);
  });

  it("requires completed lower-bound exclusion evidence for every registered template", () => {
    for (const certificate of certificates) {
      expect(certificate.search.status, certificate.templateId).toBe("exhausted");
      expect(certificate.minimumCommands, certificate.templateId).toBeGreaterThan(0);
      expect(certificate.search.excludedThroughDepth, certificate.templateId)
        .toBeGreaterThanOrEqual(certificate.minimumCommands - 1);
      const generated = createCertifiedDaily(dateFor(42), certificate.difficulty, "evidence-check", certificate.templateId);
      expect(generated.quality.minimumCommands).toBe(certificate.minimumCommands);
      expect(generated.quality.excludedThroughDepth).toBe(certificate.search.excludedThroughDepth);
      expect(generated.quality.proofCommands).toBeGreaterThanOrEqual(certificate.minimumCommands);
    }
  });
});
