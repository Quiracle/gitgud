import { applyStoryText } from "./editorial";
import { verifyCandidateArtifact, type CandidateCertificate, type CandidateNovelty, type ProceduralCandidateArtifact } from "./candidateArtifact";
import { validatePuzzleCandidate } from "../validateCandidate";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import type { PuzzleCandidate, PuzzleDifficulty, ValidatedPuzzle } from "../types";

export interface ProceduralReservation {
  date: string;
  difficulty: PuzzleDifficulty;
  artifact?: ProceduralCandidateArtifact;
  publishedId?: string;
}

export interface ProceduralRunMetadata {
  date: string;
  difficulty: PuzzleDifficulty;
  candidateId: string;
  certificate: CandidateCertificate;
  novelty: CandidateNovelty;
}

export interface ProceduralPublicationStore {
  published(date: string): Promise<{ id: string; difficulty: PuzzleDifficulty } | undefined>;
  /** Atomic and date-bound. Existing reservations always win over proposal fields. */
  reserve(proposal: { date: string; difficulty: PuzzleDifficulty; sourceFingerprint: string }): Promise<ProceduralReservation>;
  startRun(metadata: ProceduralRunMetadata): Promise<string>;
  recordStory(runId: string, source: "ai" | "template", failure?: string): Promise<void>;
  publish(runId: string, puzzle: ValidatedPuzzle): Promise<string>;
  failed(runId: string, category: string): Promise<void>;
}

export interface ProceduralPublicationDependencies {
  store: ProceduralPublicationStore;
  sourceFingerprint: string;
  chooseDifficulty: () => PuzzleDifficulty;
  /** Editorial only: receives no graph, branch names, or private proof. */
  story?: (context: { theme: string; target: Record<string, unknown> }) => Promise<unknown>;
}

/** Publishes one already-certified private artifact; it never generates or searches mechanics. */
export async function publishProceduralDaily(date: string, dependencies: ProceduralPublicationDependencies) {
  if (!isDate(date)) throw new Error("date must be a valid YYYY-MM-DD date.");
  const { store } = dependencies;
  const existing = await store.published(date);
  if (existing) return { status: "already-published" as const, ...existing };

  const reservation = await store.reserve({ date, difficulty: dependencies.chooseDifficulty(), sourceFingerprint: dependencies.sourceFingerprint });
  if (reservation.date !== date) throw new Error("Reservation date does not match the requested daily.");
  if (reservation.publishedId) return { status: "already-published" as const, id: reservation.publishedId, difficulty: reservation.difficulty };
  if (!reservation.artifact) return { status: "awaiting-candidate" as const, date, difficulty: reservation.difficulty };

  const artifact = await verifyCandidateArtifact(reservation.artifact, { sourceFingerprint: dependencies.sourceFingerprint });
  if (artifact.candidate.difficulty !== reservation.difficulty) throw new Error("Reserved artifact difficulty does not match the persisted daily difficulty.");

  const candidate: PuzzleCandidate = {
    ...structuredClone(artifact.candidate),
    id: `daily-${date}`,
    slug: `daily-${date}`,
    publishedOn: date,
    version: 1,
  };
  const runId = await store.startRun({
    date,
    difficulty: reservation.difficulty,
    candidateId: artifact.id,
    certificate: structuredClone(artifact.certificate),
    novelty: structuredClone(artifact.novelty),
  });
  try {
    let publishCandidate = candidate;
    let storySource: "ai" | "template" = "template";
    let storyFailure: string | undefined;
    if (dependencies.story) {
      try {
        const story = await dependencies.story({ theme: candidate.title, target: structuredClone(candidate.target.snapshot) });
        const edited = applyStoryText(candidate, story);
        if (edited) { publishCandidate = edited; storySource = "ai"; }
        else storyFailure = "story-invalid";
      } catch { storyFailure = "story-unavailable"; }
    }
    await store.recordStory(runId, storySource, storyFailure);
    const validated = validatePuzzleCandidate(publishCandidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    if (!validated.ok) throw new Error("Final procedural daily validation failed.");
    const id = await store.publish(runId, validated.value);
    return { status: "published" as const, id, difficulty: reservation.difficulty, source: "procedural" as const, storySource };
  } catch (error) {
    await store.failed(runId, "publication-failed");
    throw error;
  }
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
