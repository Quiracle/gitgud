import { build } from "esbuild";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createCertifiedDaily } from "./certified";
import { createCandidateArtifact, type ProceduralCandidateArtifact } from "./candidateArtifact";
import proceduralManifest from "./proceduralManifest.json";

const SOURCE = proceduralManifest.sourceFingerprint;
const DATE = "2026-11-02";
const STORY = {
  en: { title: "The Feather Festival", description: "The chickens are dressing up for a very small parade." },
  ca: { title: "La festa de les plomes", description: "Les gallines es vesteixen per a una desfilada ben petita." },
  es: { title: "La fiesta de las plumas", description: "Las gallinas se visten para un desfile muy pequeño." },
};

class EdgeQuery {
  operations: Array<[string, ...unknown[]]> = [];
  constructor(private readonly db: EdgeDatabase, readonly table: string) {}
  select(...args: unknown[]) { this.operations.push(["select", ...args]); return this; }
  eq(...args: unknown[]) { this.operations.push(["eq", ...args]); return this; }
  in(...args: unknown[]) { this.operations.push(["in", ...args]); return this; }
  lt(...args: unknown[]) { this.operations.push(["lt", ...args]); return this; }
  gt(...args: unknown[]) { this.operations.push(["gt", ...args]); return this; }
  order(...args: unknown[]) { this.operations.push(["order", ...args]); return this; }
  limit(...args: unknown[]) { this.operations.push(["limit", ...args]); return this; }
  is(...args: unknown[]) { this.operations.push(["is", ...args]); return this; }
  insert(...args: unknown[]) { this.operations.push(["insert", ...args]); return this; }
  update(...args: unknown[]) { this.operations.push(["update", ...args]); return this; }
  async maybeSingle() { this.operations.push(["maybeSingle"]); return this.db.resolve(this); }
  async single() { this.operations.push(["single"]); return this.db.resolve(this); }
  then(resolveValue: (value: any) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve(this.db.resolve(this)).then(resolveValue, reject);
  }
}

class EdgeDatabase {
  queries: EdgeQuery[] = [];
  rpcs: Array<{ name: string; args: Record<string, any> }> = [];
  runs: Array<Record<string, any>> = [];
  inventory: ProceduralCandidateArtifact[] = [];
  history: Array<{ id: string; definition: unknown; proof: { solution_commands: string[] } }> = [];
  stale: unknown[] = [];
  reservations = new Map<string, { date: string; difficulty: string; artifact?: ProceduralCandidateArtifact }>();
  published = new Map<string, { id: string; difficulty: string }>();
  publishCalls: Array<Record<string, any>> = [];
  racePublishedId?: string;
  constructor(readonly certification = SOURCE) {}
  from(table: string) { const query = new EdgeQuery(this, table); this.queries.push(query); return query; }
  async rpc(name: string, args: Record<string, any>) {
    this.rpcs.push({ name, args });
    if (name === "reserve_procedural_daily") {
      if (this.racePublishedId) return { data: { date: args.target_date, difficulty: args.target_difficulty, publishedId: this.racePublishedId }, error: null };
      const current = this.reservations.get(args.target_date);
      if (current) {
        if (!current.artifact) this.attachAvailable(current, args.target_source_fingerprint);
        return { data: structuredClone(current), error: null };
      }
      const created = { date: args.target_date, difficulty: args.target_difficulty } as { date: string; difficulty: string; artifact?: ProceduralCandidateArtifact };
      this.attachAvailable(created, args.target_source_fingerprint);
      this.reservations.set(args.target_date, structuredClone(created));
      return { data: structuredClone(created), error: null };
    }
    if (name === "register_procedural_candidates") {
      const artifacts = args.target_artifacts as ProceduralCandidateArtifact[];
      for (const artifact of artifacts) this.inventory.push(structuredClone(artifact));
      return { data: { inserted: artifacts.length, skipped: 0 }, error: null };
    }
    if (name === "stale_daily_candidates") return { data: this.stale, error: null };
    if (name === "publish_daily_puzzle") {
      this.publishCalls.push(args);
      return { data: args.target_definition.id, error: null };
    }
    return { data: null, error: null };
  }
  private attachAvailable(reservation: { difficulty: string; artifact?: ProceduralCandidateArtifact }, source: string) {
    const index = this.inventory.findIndex(item => item.candidate.difficulty === reservation.difficulty && item.certificate.sourceFingerprint === source);
    if (index >= 0) reservation.artifact = this.inventory.splice(index, 1)[0];
  }
  resolve(query: EdgeQuery) {
    const op = (name: string) => query.operations.find(([method]) => method === name);
    const eq = (key: string) => query.operations.find(([method, column]) => method === "eq" && column === key)?.[2];
    if (query.table === "daily_puzzles" && op("maybeSingle")) {
      return { data: this.published.get(String(eq("published_on"))) ?? null, error: null };
    }
    if (query.table === "daily_puzzles" && op("select")) return { data: this.history, error: null };
    if (query.table === "daily_generation_runs" && op("single")) {
      const row = { id: "run-edge-" + (this.runs.length + 1), ...query.operations.find(([method]) => method === "insert")?.[1] as object };
      this.runs.push(row);
      return { data: { id: row.id }, error: null };
    }
    if (query.table === "daily_certified_candidates" && op("select")) {
      return { data: this.inventory.map(artifact => ({
        difficulty: artifact.candidate.difficulty,
        command_pattern: artifact.novelty.commandPattern,
      })), error: null };
    }
    return { data: null, error: null };
  }
}

let handler: (request: Request) => Promise<Response>;
let bundleSource = "";
let database: EdgeDatabase;
let fetchCalls: Array<{ input: unknown; init?: RequestInit }>;
let clientCreations: number;
let edgeErrors: unknown[][];
let artifact: ProceduralCandidateArtifact;

beforeAll(async () => {
  const candidate = createCertifiedDaily("2030-01-01", "easy", "edge-artifact-fixture", "easy-0").candidate;
  artifact = await createCandidateArtifact({ candidate, status: "certified" }, { sourceFingerprint: SOURCE, excludedThroughDepth: 1 });
  const entry = resolve(process.cwd(), "supabase/functions/generate-daily-puzzle/index.ts");
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: "neutral", format: "iife", target: "es2022",
    plugins: [{
      name: "stub-supabase-client",
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /^npm:@supabase\/supabase-js@2\.76\.1$/ }, () => ({ path: "supabase-stub", namespace: "edge-test" }));
        pluginBuild.onLoad({ filter: /.*/, namespace: "edge-test" }, () => ({
          contents: "export function createClient() { return __testCreateClient(); }",
          loader: "js",
        }));
      },
    }],
  });
  bundleSource = result.outputFiles[0].text;
});

function start(
  code: string,
  register: (handler: (request: Request) => Promise<Response>) => void,
  db: EdgeDatabase,
  secrets: Record<string, string>,
  fetchImpl: (input: unknown, init?: RequestInit) => Promise<Response> = async () => { throw new Error("unexpected network call"); },
) {
  database = db;
  fetchCalls = [];
  edgeErrors = [];
  clientCreations = 0;
  const cryptoStub = { getRandomValues: (values: Uint32Array) => { values[0] = 0; return values; } };
  const wrappedFetch = async (input: unknown, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    return fetchImpl(input, init);
  };
  new Function("Deno", "fetch", "crypto", "console", "__testCreateClient", code)(
    { serve: register, env: { get: (name: string) => secrets[name] } },
    wrappedFetch, cryptoStub, { error: (...args: unknown[]) => edgeErrors.push(args) },
    () => { clientCreations += 1; return db; },
  );
}

function req(body: string, options: { secret?: string; method?: string } = {}) {
  return new Request("https://edge.test/generate-daily-puzzle", {
    method: options.method ?? "POST",
    headers: { "content-type": "application/json", ...(options.secret ? { "x-generation-secret": options.secret } : {}) },
    body: options.method === "GET" ? undefined : body,
  });
}
async function json(response: Response) { return await response.json() as Record<string, any>; }
function secrets(secret: string, ai = false) {
  return {
    DAILY_GENERATION_SECRET: secret,
    SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    ...(ai ? { OPENAI_API_KEY: "fake-key" } : {}),
  };
}

describe("compiled procedural daily Edge Function handler", () => {
  const secret = "test-generation-secret";

  it("authenticates before constructing the database client", async () => {
    let registered!: typeof handler;
    start(bundleSource, value => { registered = value; }, new EdgeDatabase(), { DAILY_GENERATION_SECRET: secret });
    const response = await registered(req("{}"));
    expect(response.status).toBe(401);
    expect(clientCreations).toBe(0);
    expect(database.queries).toHaveLength(0);
  });

  it("rejects malformed JSON, invalid dates, and unsupported modes before reservation", async () => {
    let registered!: typeof handler;
    start(bundleSource, value => { registered = value; }, new EdgeDatabase(), secrets(secret));
    expect((await registered(req("{", { secret }))).status).toBe(400);
    const invalidDate = await registered(req(JSON.stringify({ date: "2026-02-30" }), { secret }));
    expect(invalidDate.status).toBe(400);
    const invalidMode = await registered(req(JSON.stringify({ mode: "mystery" }), { secret }));
    expect(invalidMode.status).toBe(400);
    expect(database.rpcs).toHaveLength(0);
  });

  it("preflights an empty private inventory as not ready without AI or writes", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    const response = await registered(req(JSON.stringify({ mode: "preflight" }), { secret }));
    const payload = await json(response);
    expect(response.status, JSON.stringify(edgeErrors)).toBe(200);
    expect(payload).toMatchObject({ ready: false, generationMethod: "procedural-v1", certification: SOURCE, storyAvailable: false });
    expect(payload.reserveCounts).toEqual({ easy: 0, medium: 0, hard: 0 });
    expect(fetchCalls).toHaveLength(0);
    expect(db.rpcs).toHaveLength(0);
    expect(db.queries.map(query => query.table)).toEqual(["daily_certified_candidates"]);
  });

  it("exposes historical proofs only to the authenticated refill worker and includes all versions", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.history.push({ id: "daily-old-v1", definition: { id: "daily-old-v1" }, proof: { solution_commands: ["git merge feature"] } });
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    expect((await registered(req(JSON.stringify({ mode: "published-history" })))).status).toBe(401);
    expect(clientCreations).toBe(0);
    const payload = await json(await registered(req(JSON.stringify({ mode: "published-history", after: "daily-before" }), { secret })));
    expect(payload.entries).toEqual([{ id: "daily-old-v1", definition: { id: "daily-old-v1" }, solution_commands: ["git merge feature"] }]);
    expect(payload.certification).toBe(SOURCE);
    expect(db.queries[0].operations).toContainEqual(["gt", "id", "daily-before"]);
    expect(db.queries[0].operations.some(op => op.includes("is_current"))).toBe(false);
    expect(db.rpcs).toHaveLength(0);
  });

  it("requires balanced strategy coverage and does not count reordered commands as novelty", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    const patterns = ["switch → revert → switch → merge", "switch → squash → switch → cherry-pick", "merge → revert → revert → revert", "rebase → merge → revert → cherry-pick"];
    for (const difficulty of ["easy", "medium", "hard"] as const) for (let index = 0; index < 14; index++) {
      const item = structuredClone(artifact);
      item.candidate.difficulty = difficulty;
      item.novelty.commandPattern = patterns[index % patterns.length];
      db.inventory.push(item);
    }
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    expect((await json(await registered(req(JSON.stringify({ mode: "preflight" }), { secret })))).ready).toBe(true);
    const hard = db.inventory.filter(item => item.candidate.difficulty === "hard");
    hard.forEach((item, index) => { item.novelty.commandPattern = index % 2 ? "merge → revert" : "revert → merge"; });
    const reordered = await json(await registered(req(JSON.stringify({ mode: "preflight" }), { secret })));
    expect(reordered).toMatchObject({ ready: false, patternCounts: { hard: 1 }, strategyCounts: { hard: { "merge|revert": 14 } } });
    hard.forEach((item, index) => { item.novelty.commandPattern = patterns[index < 11 ? 0 : index - 10]; });
    const dominated = await json(await registered(req(JSON.stringify({ mode: "preflight" }), { secret })));
    expect(dominated).toMatchObject({ ready: false, patternCounts: { hard: 4 } });
  });

  it("queries recertification privately and counts only certificates for the active evaluator", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.stale = [{ id: artifact.id, artifact, reserved_date: "2099-01-01" }];
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    expect((await registered(req(JSON.stringify({ mode: "stale-candidates", difficulty: "easy" })))).status).toBe(401);
    expect(db.rpcs).toHaveLength(0);
    const stale = await json(await registered(req(JSON.stringify({ mode: "stale-candidates", difficulty: "easy" }), { secret })));
    expect(stale.entries).toEqual(db.stale);
    expect(db.rpcs[0]).toEqual({ name: "stale_daily_candidates", args: { target_source_fingerprint: SOURCE, target_difficulty: "easy", after_id: "" } });
    expect((await registered(req(JSON.stringify({ mode: "stale-candidates", difficulty: "invalid" }), { secret }))).status).toBe(400);
    await registered(req(JSON.stringify({ mode: "preflight" }), { secret }));
    const query = db.queries.find(item => item.table === "daily_certified_candidates")!;
    expect(query.operations).toContainEqual(["eq", "certificates.source_fingerprint", SOURCE]);
    expect(String(query.operations.find(item => item[0] === "select")?.[1])).toContain("daily_candidate_certificates!inner");
  });

  it("registers a verified private artifact and returns counters without proof data", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    const response = await registered(req(JSON.stringify({ mode: "register-candidates", artifacts: [artifact] }), { secret }));
    const payload = await json(response);
    expect(response.status, JSON.stringify({ edgeErrors, rpcs: db.rpcs })).toBe(200);
    expect(payload).toMatchObject({ inserted: 1, skipped: 0, certification: SOURCE });
    expect(JSON.stringify(payload)).not.toMatch(/solutionCommands|target_artifacts|proof/i);
    expect(db.rpcs.map(item => item.name)).toEqual(["register_procedural_candidates"]);
    expect(db.rpcs[0].args.target_artifacts[0].candidate.solutionCommands.length).toBeGreaterThan(0);

    const tampered = structuredClone(artifact);
    tampered.candidate.solutionCommands[0] = "git push";
    const rejected = await registered(req(JSON.stringify({ mode: "register-candidates", artifacts: [tampered] }), { secret }));
    expect(rejected.status).toBe(503);
    expect(db.rpcs).toHaveLength(1);
  });

  it("publishes an individually certified artifact without AI and keeps proof private", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.inventory.push(structuredClone(artifact));
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    const response = await registered(req(JSON.stringify({ date: DATE }), { secret }));
    const payload = await json(response);
    expect(response.status, JSON.stringify({ edgeErrors, rpcs: db.rpcs })).toBe(200);
    expect(payload).toMatchObject({ status: "published", difficulty: "easy", source: "procedural" });
    expect(fetchCalls).toHaveLength(0);
    const published = db.rpcs.find(item => item.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition).not.toHaveProperty("solutionCommands");
    expect(published.args.target_definition.localizations).toHaveProperty("en");
    expect(published.args.target_definition.localizations).toHaveProperty("ca");
    expect(published.args.target_definition.localizations).toHaveProperty("es");
    expect(published.args.target_solution_commands).toEqual(artifact.candidate.solutionCommands);
    expect(JSON.stringify(payload)).not.toMatch(/solutionCommands|target_solution_commands/);
  });

  it("returns awaiting-candidate when the persisted difficulty has no inventory; it never calls AI or publishes a template", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    start(bundleSource, value => { registered = value; }, db, secrets(secret, true));
    const response = await registered(req(JSON.stringify({ date: DATE }), { secret }));
    const payload = await json(response);
    expect(response.status).toBe(503);
    expect(payload).toMatchObject({ status: "awaiting-candidate", date: DATE, difficulty: "easy" });
    expect(fetchCalls).toHaveLength(0);
    expect(db.rpcs.map(item => item.name)).toEqual(["reserve_procedural_daily"]);
    expect(db.publishCalls).toHaveLength(0);
    expect(db.reservations.get(DATE)?.difficulty).toBe("easy");
  });

  it("returns a publishedId when publication wins the race after the initial read", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.racePublishedId = "winner-daily-id";
    start(bundleSource, value => { registered = value; }, db, secrets(secret));
    const response = await registered(req(JSON.stringify({ date: DATE }), { secret }));
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ status: "already-published", id: "winner-daily-id", difficulty: "easy" });
    expect(db.rpcs.map(item => item.name)).toEqual(["reserve_procedural_daily"]);
    expect(db.publishCalls).toHaveLength(0);
  });

  it("publishes deterministic localized text when story service fails", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.inventory.push(structuredClone(artifact));
    start(bundleSource, value => { registered = value; }, db, secrets(secret, true), async () => new Response("unavailable", { status: 503 }));
    const response = await registered(req(JSON.stringify({ date: "2026-11-03" }), { secret }));
    const payload = await json(response);
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: "published", storySource: "template" });
    expect(fetchCalls).toHaveLength(1);
    const published = db.rpcs.find(item => item.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition.localizations).toHaveProperty("en");
    expect(published.args.target_definition.localizations).toHaveProperty("ca");
    expect(published.args.target_definition.localizations).toHaveProperty("es");
    expect(published.args.target_solution_commands.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload)).not.toMatch(/solutionCommands|target_solution_commands/);
  });

  it("accepts only localized prose and sends the story model only theme and target", async () => {
    let registered!: typeof handler;
    const db = new EdgeDatabase();
    db.inventory.push(structuredClone(artifact));
    start(bundleSource, value => { registered = value; }, db, secrets(secret, true),
      async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(STORY) }] }] }));
    const response = await registered(req(JSON.stringify({ date: "2026-11-04" }), { secret }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ storySource: "ai" });
    const published = db.rpcs.find(item => item.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition.title).toBe(STORY.en.title);
    expect(published.args.target_definition.localizations.ca.description).toBe(STORY.ca.description);
    const requestBody = JSON.parse(String(fetchCalls[0].init?.body));
    const context = JSON.parse(requestBody.input[1].content);
    expect(Object.keys(context).sort()).toEqual(["target", "theme"]);
    expect(published.args.target_definition).not.toHaveProperty("solutionCommands");
    expect(published.args.target_solution_commands).toEqual(artifact.candidate.solutionCommands);
  });
});
