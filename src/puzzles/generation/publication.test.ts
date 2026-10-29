import { describe, expect, it } from "vitest";
import { createCertifiedDaily, selectDailyTemplate } from "./certified";
import { publishDeterministicDaily, type DailyPublicationStore, type DailyReservation, type DailyRunMetadata } from "./publication";
import type { PuzzleDifficulty, ValidatedPuzzle } from "../types";

const DATE = "2026-11-02";
const STORY = {
  en: { title: "Moonlit Studio", description: "A quiet portrait waits beneath the garden lights." },
  ca: { title: "Estudi a la llum de la lluna", description: "Un retrat tranquil espera sota els llums del jardí." },
  es: { title: "Estudio a la luz de la luna", description: "Un retrato tranquilo espera bajo las luces del jardín." },
};

class MemoryStore implements DailyPublicationStore {
  reservations: DailyReservation[] = [];
  runs: Array<{ id: string; metadata: DailyRunMetadata; story?: string; storyFailure?: string; status: string }> = [];
  publishedRows: Array<{ date: string; id: string; difficulty: PuzzleDifficulty; puzzle: ValidatedPuzzle }> = [];
  failNextPublish = false;
  private reservationByDate = new Map<string, DailyReservation>();
  private nextRun = 0;

  async published(date: string) {
    const row = this.publishedRows.find((item) => item.date === date);
    return row && { id: row.id, difficulty: row.difficulty };
  }
  async recent() { return []; }
  async reserve(proposal: DailyReservation) {
    const current = this.reservationByDate.get(proposal.date);
    if (current) return structuredClone(current);
    const persisted = structuredClone(proposal);
    this.reservationByDate.set(proposal.date, persisted);
    this.reservations.push(persisted);
    return structuredClone(persisted);
  }
  async startRun(metadata: DailyRunMetadata) {
    const id = `run-${++this.nextRun}`;
    this.runs.push({ id, metadata: structuredClone(metadata), status: "running" });
    return id;
  }
  async recordStory(runId: string, source: "ai" | "template", failure?: string) {
    const run = this.runs.find((item) => item.id === runId)!;
    run.story = source;
    run.storyFailure = failure;
  }
  async publish(runId: string, puzzle: ValidatedPuzzle) {
    if (this.failNextPublish) {
      this.failNextPublish = false;
      throw new Error("transient persistence failure");
    }
    const existing = this.publishedRows.find((row) => row.date === puzzle.puzzle.publishedOn);
    if (existing) {
      this.runs.find((run) => run.id === runId)!.status = "superseded";
      return existing.id;
    }
    const id = puzzle.puzzle.id;
    this.publishedRows.push({ date: puzzle.puzzle.publishedOn!, id, difficulty: puzzle.puzzle.difficulty, puzzle: structuredClone(puzzle) });
    this.runs.find((run) => run.id === runId)!.status = "published";
    return id;
  }
  async failed(runId: string, _category: string) {
    this.runs.find((run) => run.id === runId)!.status = "failed";
  }
  persistedReservation(date: string) { return this.reservationByDate.get(date); }
}

function dependencies(store: MemoryStore, overrides: Partial<Parameters<typeof publishDeterministicDaily>[1]> = {}) {
  return {
    store,
    chooseDifficulty: () => "easy" as const,
    createSeed: () => "first-seed",
    ...overrides,
  };
}

function mechanicsOnly(puzzle: ValidatedPuzzle["puzzle"]) {
  return {
    difficulty: puzzle.difficulty,
    target: puzzle.target,
    allowedCommands: puzzle.allowedCommands,
    initialRepository: {
      initialState: puzzle.initialRepository.initialState,
      currentBranch: puzzle.initialRepository.currentBranch,
      head: puzzle.initialRepository.head,
      branches: puzzle.initialRepository.branches,
      nextGeneratedId: puzzle.initialRepository.nextGeneratedId,
      commits: Object.fromEntries(Object.entries(puzzle.initialRepository.commits).map(([id, commit]) => [id, {
        id: commit.id, parents: commit.parents, changes: commit.changes,
      }])),
    },
  };
}

describe("deterministic daily publication orchestration", () => {
  it("returns an existing publication without choosing a seed or calling story AI", async () => {
    const store = new MemoryStore();
    store.publishedRows.push({ date: DATE, id: `daily-${DATE}`, difficulty: "medium", puzzle: {} as ValidatedPuzzle });
    let randomCalls = 0;
    let storyCalls = 0;
    const result = await publishDeterministicDaily(DATE, dependencies(store, {
      chooseDifficulty: () => { randomCalls += 1; return "easy"; },
      createSeed: () => { randomCalls += 1; return "unused"; },
      story: async () => { storyCalls += 1; return STORY; },
    }));
    expect(result).toEqual({ status: "already-published", id: `daily-${DATE}`, difficulty: "medium" });
    expect(randomCalls).toBe(0);
    expect(storyCalls).toBe(0);
    expect(store.runs).toHaveLength(0);
  });

  it("uses persisted difficulty and seed over a different retry proposal", async () => {
    const store = new MemoryStore();
    await store.reserve({ date: DATE, difficulty: "medium", seed: "durable-seed", templateId: "medium-5" });
    const result = await publishDeterministicDaily(DATE, dependencies(store, {
      chooseDifficulty: () => "easy",
      createSeed: () => "different-retry-seed",
    }));
    expect(result).toMatchObject({ status: "published", difficulty: "medium" });
    expect(store.persistedReservation(DATE)).toMatchObject({ difficulty: "medium", seed: "durable-seed", templateId: "medium-5" });
    expect(store.runs[0].metadata).toMatchObject({ difficulty: "medium", templateId: "medium-5" });
    expect(store.publishedRows[0].puzzle.puzzle.initialRepository)
      .toEqual(createCertifiedDaily(DATE, "medium", "durable-seed", "medium-5").candidate.initialRepository);
  });

  it.each([
    ["malformed object", { en: { title: "Only English", description: "Missing other languages." } }],
    ["refusal payload", { refusal: "I cannot provide the requested text." }],
    ["unsafe text", { en: { title: "Run git cherry-pick", description: "Try git merge now." }, ca: STORY.ca, es: STORY.es }],
  ])("publishes safe template translations after %s and leaves mechanics unchanged", async (_label, response) => {
    const store = new MemoryStore();
    const templateId = selectDailyTemplate("easy", "first-seed", []);
    const before = createCertifiedDaily(DATE, "easy", "first-seed", templateId).candidate;
    const result = await publishDeterministicDaily(DATE, dependencies(store, { story: async () => response }));
    expect(result).toMatchObject({ status: "published", storySource: "template" });
    expect(store.runs[0]).toMatchObject({ story: "template", storyFailure: "story-invalid" });
    const published = store.publishedRows[0].puzzle.puzzle;
    expect(published.localizations).toBeDefined();
    expect(Object.keys(published.localizations!)).toEqual(["en", "ca", "es"]);
    expect(mechanicsOnly(published)).toEqual(mechanicsOnly(before));
    expect(published.title).toBe(published.localizations!.en.title);
  });

  it("falls back after thrown story service and only exposes target/theme to editorial AI", async () => {
    const store = new MemoryStore();
    let context: unknown;
    const result = await publishDeterministicDaily(DATE, dependencies(store, {
      story: async (value) => { context = value; throw new Error("offline"); },
    }));
    expect(result).toMatchObject({ status: "published", storySource: "template" });
    expect(store.runs[0]).toMatchObject({ story: "template", storyFailure: "story-unavailable" });
    expect(context).toMatchObject({ theme: expect.any(String), target: expect.any(Object) });
    expect(Object.keys(context as object).sort()).toEqual(["target", "theme"]);
    expect(JSON.stringify(context)).not.toMatch(/solutionCommands|commits|branches|proof|graph/i);
    expect(Object.keys(store.publishedRows[0].puzzle.puzzle)).not.toContain("solutionCommands");
    expect(store.publishedRows[0].puzzle.privateMetadata.solutionCommands.length).toBeGreaterThan(0);
  });

  it("keeps the reserved puzzle identity across a retry after storage failure", async () => {
    const store = new MemoryStore();
    store.failNextPublish = true;
    await expect(publishDeterministicDaily(DATE, dependencies(store))).rejects.toThrow("transient persistence failure");
    const reservedTemplate = selectDailyTemplate("easy", "first-seed", []);
    expect(store.persistedReservation(DATE)).toMatchObject({ seed: "first-seed", difficulty: "easy", templateId: reservedTemplate });
    const retry = await publishDeterministicDaily(DATE, dependencies(store, {
      chooseDifficulty: () => "medium", createSeed: () => "retry-seed",
    }));
    expect(retry).toMatchObject({ status: "published", difficulty: "easy" });
    expect(store.runs[0].metadata.signature).toBe(store.runs[1].metadata.signature);
    expect(store.publishedRows).toHaveLength(1);
    expect(retry.id).toBe(`daily-${DATE}`);
  });

  it("publishes only one result under concurrent calls while marking the losing run", async () => {
    const store = new MemoryStore();
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const story = async () => {
      calls += 1;
      if (calls === 2) release();
      await gate;
      return STORY;
    };
    const results = await Promise.all([
      publishDeterministicDaily(DATE, dependencies(store, { story })),
      publishDeterministicDaily(DATE, dependencies(store, { story })),
    ]);
    expect(results.every((result) => result.status === "published")).toBe(true);
    expect(store.publishedRows).toHaveLength(1);
    expect(store.runs.map((run) => run.status).sort()).toEqual(["published", "superseded"]);
  });

  it("rejects an unknown certificate template before starting a run or calling story", async () => {
    const store = new MemoryStore();
    await store.reserve({ date: DATE, difficulty: "easy", seed: "saved", templateId: "not-certified" });
    let storyCalls = 0;
    await expect(publishDeterministicDaily(DATE, dependencies(store, {
      story: async () => { storyCalls += 1; return STORY; },
    }))).rejects.toThrow(/certificate/i);
    expect(storyCalls).toBe(0);
    expect(store.runs).toHaveLength(0);
    expect(store.publishedRows).toHaveLength(0);
  });

  it("selects a reproducible certified template for a seed", () => {
    expect(selectDailyTemplate("easy", "repeatable", [])).toBe(selectDailyTemplate("easy", "repeatable", []));
    const selected = selectDailyTemplate("easy", "repeatable", []);
    expect(createCertifiedDaily(DATE, "easy", "repeatable", selected).signature)
      .toBe(createCertifiedDaily(DATE, "easy", "repeatable", selected).signature);
  });
});
