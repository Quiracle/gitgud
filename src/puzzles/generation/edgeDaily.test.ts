import { build } from "esbuild";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

class EdgeQuery {
  operations: Array<[string, ...unknown[]]> = [];
  constructor(private readonly db: EdgeDatabase, readonly table: string) {}
  select(...args: unknown[]) { this.operations.push(["select", ...args]); return this; }
  eq(...args: unknown[]) { this.operations.push(["eq", ...args]); return this; }
  in(...args: unknown[]) { this.operations.push(["in", ...args]); return this; }
  lt(...args: unknown[]) { this.operations.push(["lt", ...args]); return this; }
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
  templateOverride?: string;
  constructor(readonly certification?: string) {}
  from(table: string) { const query = new EdgeQuery(this, table); this.queries.push(query); return query; }
  async rpc(name: string, args: Record<string, any>) {
    this.rpcs.push({ name, args });
    if (name === "reserve_deterministic_daily") {
      return { data: {
        published_on: args.target_date, selected_difficulty: args.target_difficulty,
        seed: args.target_seed,
        brief: { templateId: this.templateOverride ?? args.target_template_id, certification: this.certification ?? args.target_certification },
      }, error: null };
    }
    if (name === "publish_daily_puzzle") return { data: args.target_definition.id, error: null };
    return { data: null, error: null };
  }
  resolve(query: EdgeQuery) {
    const op = (name: string) => query.operations.find(([method]) => method === name);
    if (query.table === "daily_puzzles" && op("maybeSingle")) return { data: null, error: null };
    if (query.table === "daily_generation_runs" && op("single")) return { data: { id: "run-edge-1" }, error: null };
    if (query.table === "daily_generation_runs" && op("select")) return { data: [], error: null };
    if (query.table === "daily_mechanics_reserve" && op("select")) return { data: [], count: 0, error: null };
    return { data: null, error: null };
  }
}

let handler: (request: Request) => Promise<Response>;
let bundleSource = "";
let database: EdgeDatabase;
let env: Record<string, string>;
let fetchCalls: Array<{ input: unknown; init?: RequestInit }>;
let clientCreations: number;
let uuidCount: number;
let edgeErrors: unknown[][];

beforeAll(async () => {
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
  const register = (asyncHandler: (request: Request) => Promise<Response>) => { handler = asyncHandler; };
  start(bundleSource, register, new EdgeDatabase(), {});
});

function start(
  code: string,
  register: (handler: (request: Request) => Promise<Response>) => void,
  db: EdgeDatabase,
  secrets: Record<string, string>,
  fetchImpl: (input: unknown, init?: RequestInit) => Promise<Response> = async () => { throw new Error("unexpected network call"); },
) {
  database = db;
  env = secrets;
  fetchCalls = [];
  edgeErrors = [];
  clientCreations = 0;
  uuidCount = 0;
  const cryptoStub = {
    randomUUID: () => `seed-${++uuidCount}`,
    getRandomValues: (values: Uint32Array) => { values[0] = 0; return values; },
  };
  const wrappedFetch = async (input: unknown, init?: RequestInit) => {
    fetchCalls.push({ input, init });
    return fetchImpl(input, init);
  };
  // Run trusted, locally compiled source in the same JS realm as Request and
  // structuredClone. Inject only external boundaries, never mechanics helpers.
  new Function("Deno", "fetch", "crypto", "console", "__testCreateClient", code)(
    { serve: register, env: { get: (name: string) => env[name] } },
    wrappedFetch, cryptoStub, { error: (...args: unknown[]) => edgeErrors.push(args) },
    () => { clientCreations += 1; return db; },
  );
}

function req(body: string, options: { secret?: string; method?: string } = {}) {
  return new Request("https://edge.test/generate-daily-puzzle", {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json",
      ...(options.secret ? { "x-generation-secret": options.secret } : {}),
    },
    body: options.method === "GET" ? undefined : body,
  });
}

async function json(response: Response) { return await response.json() as Record<string, any>; }

describe("compiled daily Edge Function handler", () => {
  const secret = "test-generation-secret";

  it("authenticates before constructing a database client", async () => {
    start(bundleSource, (registered) => { handler = registered; }, new EdgeDatabase(), { DAILY_GENERATION_SECRET: secret });
    const response = await handler(req("{}"));
    expect(response.status).toBe(401);
    expect(clientCreations).toBe(0);
    expect(database.queries).toHaveLength(0);
  });

  it("rejects malformed JSON, invalid dates, and unsupported modes before reserving", async () => {
    start(bundleSource, (registered) => { handler = registered; }, new EdgeDatabase(), { DAILY_GENERATION_SECRET: secret });
    const response = await handler(req("{", { secret }));
    expect(response.status).toBe(400);
    expect(clientCreations).toBe(0);

    start(bundleSource, (registered) => { handler = registered; }, new EdgeDatabase(), {
      DAILY_GENERATION_SECRET: secret, SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    const invalidDate = await handler(req(JSON.stringify({ date: "2026-02-30" }), { secret }));
    expect(invalidDate.status).toBe(400);
    const invalidMode = await handler(req(JSON.stringify({ mode: "mystery" }), { secret }));
    expect(invalidMode.status).toBe(400);
    expect(database.rpcs).toHaveLength(0);
  });

  it("preflights registry readiness without AI or reservation writes", async () => {
    const db = new EdgeDatabase();
    db.templateOverride = "easy-0";
    start(bundleSource, (registered) => { handler = registered; }, db, {
      DAILY_GENERATION_SECRET: secret, SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    const response = await handler(req(JSON.stringify({ mode: "preflight" }), { secret }));
    const payload = await json(response);
    expect(response.status, JSON.stringify({ edgeErrors, rpcs: db.rpcs })).toBe(200);
    expect(payload.ready).toBe(true);
    expect(payload.generationMethod).toBe("deterministic-v1");
    expect(payload.storyAvailable).toBe(false);
    expect(fetchCalls).toHaveLength(0);
    expect(db.rpcs).toHaveLength(0);
    expect(db.queries.filter((query) => query.table === "daily_mechanics_reserve")).toHaveLength(3);
  });

  it("publishes a deterministic daily without AI and keeps the proof out of the public HTTP response", async () => {
    const db = new EdgeDatabase();
    db.templateOverride = "easy-0";
    start(bundleSource, (registered) => { handler = registered; }, db, {
      DAILY_GENERATION_SECRET: secret, SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });
    const response = await handler(req(JSON.stringify({ date: "2026-11-02" }), { secret }));
    const payload = await json(response);
    expect(response.status, JSON.stringify({ edgeErrors, rpcs: db.rpcs })).toBe(200);
    expect(payload).toMatchObject({ status: "published", difficulty: "easy", source: "deterministic" });
    expect(fetchCalls).toHaveLength(0);
    const published = db.rpcs.find((entry) => entry.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition).not.toHaveProperty("solutionCommands");
    expect(published.args.target_definition.localizations).toHaveProperty("en");
    expect(published.args.target_definition.localizations).toHaveProperty("ca");
    expect(published.args.target_definition.localizations).toHaveProperty("es");
    expect(published.args.target_solution_commands.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload)).not.toMatch(/solutionCommands|target_solution_commands/);
  });

  it("publishes template text when the external story request fails", async () => {
    const db = new EdgeDatabase();
    start(bundleSource, (registered) => { handler = registered; }, db, {
      DAILY_GENERATION_SECRET: secret, SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", OPENAI_API_KEY: "fake-key",
    }, async () => new Response("unavailable", { status: 503 }));
    const response = await handler(req(JSON.stringify({ date: "2026-11-03" }), { secret }));
    const payload = await json(response);
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ status: "published", storySource: "template" });
    expect(fetchCalls).toHaveLength(1);
    const published = db.rpcs.find((entry) => entry.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition.localizations).toHaveProperty("en");
    expect(published.args.target_definition.localizations).toHaveProperty("ca");
    expect(published.args.target_definition.localizations).toHaveProperty("es");
    expect(published.args.target_solution_commands.length).toBeGreaterThan(0);
    expect(JSON.stringify(payload)).not.toMatch(/solutionCommands|target_solution_commands/);
  });

  it("accepts only localized story prose from a successful structured response", async () => {
    const story = {
      en: { title: "The Feather Festival", description: "The chickens are dressing up for a very small parade." },
      ca: { title: "La festa de les plomes", description: "Les gallines es vesteixen per a una desfilada ben petita." },
      es: { title: "La fiesta de las plumas", description: "Las gallinas se visten para un desfile muy pequeño." },
    };
    const db = new EdgeDatabase();
    start(bundleSource, registered => { handler = registered; }, db, {
      DAILY_GENERATION_SECRET: secret, SUPABASE_URL: "https://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "service-key", OPENAI_API_KEY: "fake-key",
    }, async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(story) }] }] }));
    const response = await handler(req(JSON.stringify({ date: "2026-11-04" }), { secret }));
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ storySource: "ai" });
    const published = db.rpcs.find(entry => entry.name === "publish_daily_puzzle")!;
    expect(published.args.target_definition.title).toBe(story.en.title);
    expect(published.args.target_definition.localizations.ca.description).toBe(story.ca.description);
    const requestBody = JSON.parse(String(fetchCalls[0].init?.body));
    const context = JSON.parse(requestBody.input[1].content);
    expect(Object.keys(context).sort()).toEqual(["target", "theme"]);
    expect(published.args.target_definition).not.toHaveProperty("solutionCommands");
  });
});
