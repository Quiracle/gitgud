import { createCertifiedDaily, DAILY_STORY_PROMPT_VERSION, selectDailyTemplate, type RecentMechanics } from "./certified";
import { applyStoryText } from "./editorial";
import { validatePuzzleCandidate } from "../validateCandidate";
import { CHICKEN_V2_SEMANTIC_POLICY } from "../chickenTheme";
import type { PuzzleCandidate, PuzzleDifficulty, ValidatedPuzzle } from "../types";

export interface DailyReservation {
  date: string;
  difficulty: PuzzleDifficulty;
  seed: string;
  templateId?: string;
}
export interface DailyRunMetadata {
  date: string;
  difficulty: PuzzleDifficulty;
  templateId: string;
  family: string;
  signature: string;
  generatorVersion: number;
  promptVersion: number;
  quality: ReturnType<typeof createCertifiedDaily>["quality"];
}
export interface DailyPublicationStore {
  published(date: string): Promise<{ id: string; difficulty: PuzzleDifficulty } | undefined>;
  recent(date: string): Promise<RecentMechanics[]>;
  /** Atomic first-writer-wins; all returned fields come from the persisted reservation. */
  reserve(proposal: DailyReservation): Promise<DailyReservation>;
  startRun(metadata: DailyRunMetadata): Promise<string>;
  recordStory(runId: string, source: "ai" | "template", failure?: string): Promise<void>;
  publish(runId: string, puzzle: ValidatedPuzzle): Promise<string>;
  failed(runId: string, category: string): Promise<void>;
}

export interface DailyPublisherDependencies {
  store: DailyPublicationStore;
  chooseDifficulty: () => PuzzleDifficulty;
  createSeed: () => string;
  /** Optional editorial service. It never receives the proof or graph. */
  story?: (context: { theme: string; target: Record<string, unknown> }) => Promise<unknown>;
}

/** Publishing orchestration shared with non-network integration tests. */
export async function publishDeterministicDaily(date: string, dependencies: DailyPublisherDependencies) {
  const { store } = dependencies;
  const published = await store.published(date);
  if (published) return { status: "already-published" as const, ...published };
  const recent = await store.recent(date);
  const difficulty = dependencies.chooseDifficulty();
  const seed = dependencies.createSeed();
  const reservation = await store.reserve({ date, difficulty, seed, templateId: selectDailyTemplate(difficulty, seed, recent) });
  if (reservation.date !== date) throw new Error("Reservation date does not match the requested daily.");
  // Reservations made by the legacy publisher still retain their original difficulty/seed.
  const templateId = reservation.templateId ?? selectDailyTemplate(reservation.difficulty, reservation.seed, recent);
  const generated = createCertifiedDaily(date, reservation.difficulty, reservation.seed, templateId);
  const runId = await store.startRun({
    date, difficulty: reservation.difficulty, templateId,
    family: generated.family, signature: generated.signature,
    generatorVersion: generated.generatorVersion,
    promptVersion: DAILY_STORY_PROMPT_VERSION, quality: generated.quality,
  });
  try {
    let candidate: PuzzleCandidate = generated.candidate;
    let storySource: "ai" | "template" = "template";
    let storyFailure: string | undefined;
    if (dependencies.story) {
      try {
        const prose = await dependencies.story({ theme: candidate.title, target: structuredClone(candidate.target.snapshot) });
        const edited = applyStoryText(candidate, prose);
        if (edited) { candidate = edited; storySource = "ai"; }
        else storyFailure = "story-invalid";
      } catch { storyFailure = "story-unavailable"; }
    }
    await store.recordStory(runId, storySource, storyFailure);
    const validated = validatePuzzleCandidate(candidate, { semantic: CHICKEN_V2_SEMANTIC_POLICY });
    if (!validated.ok) throw new Error("Final daily publication validation failed.");
    const id = await store.publish(runId, validated.value);
    return { status: "published" as const, id, difficulty: reservation.difficulty, source: "deterministic" as const, storySource };
  } catch (error) {
    await store.failed(runId, "publication-failed");
    throw error;
  }
}
