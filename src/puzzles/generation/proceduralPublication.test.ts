import { beforeAll, describe, expect, it } from "vitest";
import type { PuzzleCandidate, ValidatedPuzzle, PuzzleDifficulty } from "../types";
import { createTemplateCandidate } from "./templates";
import { createCandidateArtifact, type ProceduralCandidateArtifact } from "./candidateArtifact";
import { publishProceduralDaily, type ProceduralPublicationStore, type ProceduralReservation, type ProceduralRunMetadata } from "./proceduralPublication";

const DATE = "2030-04-05";
const SOURCE = "c".repeat(64);
const STORY = {
  en: { title: "Portrait at Dusk", description: "A bright scene waits for its final colors." },
  ca: { title: "Retrat al capvespre", description: "Una escena lluminosa espera els colors finals." },
  es: { title: "Retrato al atardecer", description: "Una escena luminosa espera sus colores finales." },
};

beforeAll(() => {
  if (!globalThis.crypto?.subtle) throw new Error("Tests require Web Crypto; run with NODE_OPTIONS=--experimental-global-webcrypto.");
});

async function fixture() {
  const candidate = createTemplateCandidate("medium-6", DATE, "publication-fixture").candidate;
  return createCandidateArtifact({ candidate, status: "certified" }, { sourceFingerprint: SOURCE, excludedThroughDepth: 3 });
}

class MemoryStore implements ProceduralPublicationStore {
  pool = new Map<PuzzleDifficulty, ProceduralCandidateArtifact>();
  runs: Array<{ id: string; metadata: ProceduralRunMetadata; status: string; story?: string; storyFailure?: string }> = [];
  publishedRows: Array<{ date: string; id: string; difficulty: PuzzleDifficulty; value: ValidatedPuzzle }> = [];
  reservations = new Map<string, ProceduralReservation>();
  reserveCalls = 0;
  failNextPublish = false;
  private nextRun = 0;

  async published(date: string) {
    const row = this.publishedRows.find(value => value.date === date);
    return row && { id: row.id, difficulty: row.difficulty };
  }
  async reserve(proposal: { date: string; difficulty: PuzzleDifficulty; sourceFingerprint: string }) {
    this.reserveCalls++;
    const existing = this.reservations.get(proposal.date);
    if (existing) return structuredClone(existing);
    const reservation = { date: proposal.date, difficulty: proposal.difficulty, artifact: this.pool.get(proposal.difficulty) };
    this.reservations.set(proposal.date, structuredClone(reservation));
    return structuredClone(reservation);
  }
  async startRun(metadata: ProceduralRunMetadata) {
    const id = `run-${++this.nextRun}`;
    this.runs.push({ id, metadata: structuredClone(metadata), status: "running" });
    return id;
  }
  async recordStory(runId: string, source: "ai" | "template", failure?: string) {
    const run = this.runs.find(value => value.id === runId)!;
    run.story = source;
    run.storyFailure = failure;
  }
  async publish(runId: string, value: ValidatedPuzzle) {
    if (this.failNextPublish) { this.failNextPublish = false; throw new Error("temporary publish failure"); }
    const date = value.puzzle.publishedOn!;
    const existing = this.publishedRows.find(row => row.date === date);
    if (existing) { this.runs.find(run => run.id === runId)!.status = "superseded"; return existing.id; }
    const id = value.puzzle.id;
    this.publishedRows.push({ date, id, difficulty: value.puzzle.difficulty, value: structuredClone(value) });
    this.runs.find(run => run.id === runId)!.status = "published";
    return id;
  }
  async failed(runId: string) { this.runs.find(value => value.id === runId)!.status = "failed"; }
}

function dependencies(store: MemoryStore, overrides: Partial<Parameters<typeof publishProceduralDaily>[1]> = {}) {
  return { store, sourceFingerprint: SOURCE, chooseDifficulty: () => "medium" as const, ...overrides };
}

function mechanics(value: ValidatedPuzzle["puzzle"] | PuzzleCandidate) {
  return {
    difficulty: value.difficulty,
    target: value.target,
    allowedCommands: value.allowedCommands,
    initialState: value.initialRepository.initialState,
    branches: value.initialRepository.branches,
    currentBranch: value.initialRepository.currentBranch,
    head: value.initialRepository.head,
    commits: Object.fromEntries(Object.entries(value.initialRepository.commits).map(([id, commit]) => [id, { id: commit.id, parents: commit.parents, changes: commit.changes, provenance: commit.provenance }]))
  };
}

describe("procedural daily publication", () => {
  it("uses the persisted candidate and difficulty on retry, and keeps its proof private", async () => {
    const artifact = await fixture();
    const store = new MemoryStore();
    store.pool.set("medium", artifact);
    store.failNextPublish = true;
    await expect(publishProceduralDaily(DATE, dependencies(store))).rejects.toThrow("temporary publish failure");
    const firstCandidateId = store.runs[0].metadata.candidateId;
    const retry = await publishProceduralDaily(DATE, dependencies(store, { chooseDifficulty: () => "hard" }));
    expect(retry).toMatchObject({ status: "published", difficulty: "medium", id: `daily-${DATE}` });
    expect(store.reserveCalls).toBe(2);
    expect(store.runs.map(run => run.metadata.candidateId)).toEqual([firstCandidateId, firstCandidateId]);
    const saved = store.publishedRows[0].value;
    expect(saved.puzzle).not.toHaveProperty("solutionCommands");
    expect(saved.privateMetadata.solutionCommands).toEqual(artifact.candidate.solutionCommands);
    expect(saved.puzzle).toMatchObject({ id: `daily-${DATE}`, slug: `daily-${DATE}`, publishedOn: DATE, version: 1 });
  });

  it("waits when the candidate pool is empty without invoking story or searching again", async () => {
    const store = new MemoryStore();
    let difficultyCalls = 0, storyCalls = 0;
    const deps = dependencies(store, {
      chooseDifficulty: () => { difficultyCalls++; return "hard"; },
      story: async () => { storyCalls++; return STORY; },
    });
    const first = await publishProceduralDaily(DATE, deps);
    const retry = await publishProceduralDaily(DATE, deps);
    expect(first).toMatchObject({ status: "awaiting-candidate", difficulty: "hard" });
    expect(retry).toEqual(first);
    expect(store.reservations.get(DATE)).toMatchObject({ difficulty: "hard" });
    expect(store.reserveCalls).toBe(2);
    expect(difficultyCalls).toBe(2);
    expect(storyCalls).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it("rejects wrong source fingerprints and reservation difficulty before starting a run", async () => {
    const artifact = await fixture();
    const sourceStore = new MemoryStore();
    sourceStore.pool.set("medium", artifact);
    await expect(publishProceduralDaily(DATE, dependencies(sourceStore, { sourceFingerprint: "d".repeat(64) }))).rejects.toThrow(/not trusted/);
    expect(sourceStore.runs).toHaveLength(0);

    const difficultyStore = new MemoryStore();
    difficultyStore.pool.set("hard", artifact);
    await expect(publishProceduralDaily(DATE, dependencies(difficultyStore, { chooseDifficulty: () => "hard" }))).rejects.toThrow(/difficulty/);
    expect(difficultyStore.runs).toHaveLength(0);
  });

  it("limits AI to story context and preserves mechanics while applying valid localized prose", async () => {
    const artifact = await fixture();
    const store = new MemoryStore();
    store.pool.set("medium", artifact);
    let context: unknown;
    const result = await publishProceduralDaily(DATE, dependencies(store, {
      story: async value => { context = value; return STORY; },
    }));
    expect(result).toMatchObject({ status: "published", storySource: "ai" });
    expect(Object.keys(context as object).sort()).toEqual(["target", "theme"]);
    expect(JSON.stringify(context)).not.toMatch(/solutionCommands|commits|branches|proof|graph/i);
    const saved = store.publishedRows[0].value;
    const rebound = structuredClone(artifact.candidate);
    rebound.id = `daily-${DATE}`; rebound.slug = `daily-${DATE}`; rebound.publishedOn = DATE; rebound.version = 1;
    expect(mechanics(saved.puzzle)).toEqual(mechanics(rebound));
    expect(saved.puzzle.localizations?.en.title).toBe(STORY.en.title);
    expect(saved.puzzle.initialRepository.commits.c1.message).toBe(artifact.candidate.initialRepository.commits.c1.message);
  });

  it("falls back to deterministic localized prose when story text is invalid", async () => {
    const artifact = await fixture();
    const store = new MemoryStore(); store.pool.set("medium", artifact);
    const result = await publishProceduralDaily(DATE, dependencies(store, { story: async () => ({ en: STORY.en }) }));
    expect(result).toMatchObject({ status: "published", storySource: "template" });
    expect(store.runs[0]).toMatchObject({ story: "template", storyFailure: "story-invalid" });
    expect(store.publishedRows[0].value.puzzle.localizations?.ca.title).toBe(artifact.candidate.localizations?.ca.title);
  });

  it("lets atomic storage settle concurrent publication attempts for the same reservation", async () => {
    const artifact = await fixture();
    const store = new MemoryStore(); store.pool.set("medium", artifact);
    let calls = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const story = async () => { if (++calls === 2) release(); await gate; return STORY; };
    const results = await Promise.all([
      publishProceduralDaily(DATE, dependencies(store, { story })),
      publishProceduralDaily(DATE, dependencies(store, { story })),
    ]);
    expect(results.every(result => result.status === "published" && result.id === `daily-${DATE}`)).toBe(true);
    expect(store.publishedRows).toHaveLength(1);
    expect(store.runs.map(run => run.metadata.candidateId)).toEqual([artifact.id, artifact.id]);
  });
});

