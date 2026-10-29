import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { webcrypto } from "node:crypto";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";

// Local SQL-backed publication integration check. No network, AI, UI, or hosted concurrency.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
await mkdir("daily-review.local", { recursive: true });
const localRequire = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
let PGlite;
try { ({ PGlite } = localRequire("@electric-sql/pglite")); }
catch { throw new Error("Install the optional local SQL runtime first: npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.12"); }
const db = new PGlite();
const directory = await mkdtemp(resolve("daily-review.local/publication-check-"));
const sourceFingerprint = await dailyCertificateSource();
const manifest = JSON.parse(await readFile("src/puzzles/generation/proceduralManifest.json", "utf8"));
assert.equal(manifest.sourceFingerprint, sourceFingerprint, "Run pnpm daily:check before this integration check.");

try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const file of [
    "202610090001_ai_daily_generation.sql",
    "202610100001_generation_quality_metrics.sql",
    "202610110002_daily_par_commands.sql",
    "20261029161959_deterministic_daily_generation.sql",
    "20261029162003_procedural_daily_candidate_queue.sql",
  ]) {
    let sql = await readFile(resolve("supabase/migrations", file), "utf8");
    // PGlite has built-in gen_random_uuid; skip only the extension statement.
    sql = sql.replace(/^\s*create extension if not exists pgcrypto;\s*$/im, "");
    await db.exec(sql);
  }

  const compiled = await build({ stdin: {
    contents: "export { createTemplateCandidate } from './src/puzzles/generation/templates'; export { certifyProceduralBatch } from './src/puzzles/generation/proceduralCertification'; export { createCandidateArtifact } from './src/puzzles/generation/candidateArtifact'; export { publishProceduralDaily } from './src/puzzles/generation/proceduralPublication'; export { createProceduralDailyStore } from './supabase/functions/_shared/proceduralDailyStore';",
    resolveDir: process.cwd(), loader: "ts",
  }, bundle: true, write: false, format: "esm", platform: "node" });
  const domainFile = resolve(directory, "publication.mjs");
  await writeFile(domainFile, compiled.outputFiles[0].text);
  const domain = await import(pathToFileURL(domainFile).href);

  const fixture = async (templateId, date) => {
    const candidate = domain.createTemplateCandidate(templateId, date, `publication-check-${templateId}`).candidate;
    const maxDepth = { easy: 1, medium: 3, hard: 5 }[candidate.difficulty];
    const search = domain.certifyProceduralBatch([candidate], { maxDepth });
    assert.equal(search.verdicts[0]?.status, "certified", `fixture ${templateId} must certify`);
    return domain.createCandidateArtifact(search.verdicts[0], { sourceFingerprint, excludedThroughDepth: search.excludedThroughDepth });
  };
  const easy = await fixture("easy-0", "2099-01-01");
  const spare = await fixture("easy-1", "2099-01-02");
  const hard = await fixture("hard-6", "2099-02-02");
  const roleQuery = async (role, query, params = []) => {
    await db.exec(`set role ${role}`);
    try { return await db.query(query, params); }
    finally { await db.exec("reset role"); }
  };
  const register = async artifact => roleQuery("service_role", "select public.register_procedural_candidates($1::jsonb) as result", [JSON.stringify([artifact])]);
  assert.deepEqual((await register(easy)).rows[0].result, { inserted: 1, skipped: 0 });
  assert.deepEqual((await register(spare)).rows[0].result, { inserted: 1, skipped: 0 });

  const adapterClient = createPGliteServiceClient(db);
  const store = domain.createProceduralDailyStore(adapterClient);
  const publish = (date, chooseDifficulty) => domain.publishProceduralDaily(date, { store, sourceFingerprint, chooseDifficulty });

  const first = await publish("2099-01-01", () => "easy");
  assert.deepEqual(first, { status: "published", id: "daily-2099-01-01", difficulty: "easy", source: "procedural", storySource: "template" });
  const publicRow = (await db.query("select * from public.daily_puzzles where id=$1", [first.id])).rows[0];
  assert.equal(publicRow.par_commands, easy.certificate.proofCommands);
  assert.equal(publicRow.definition.parCommands, undefined, "advisory par is stored in its metadata column");
  assert.equal(publicRow.definition.solutionCommands, undefined);
  assert.equal(JSON.stringify(publicRow.definition).includes("solutionCommands"), false);
  const privateRow = (await db.query("select solution_commands from public.daily_puzzle_private where puzzle_id=$1", [first.id])).rows[0];
  assert.deepEqual(privateRow.solution_commands, easy.candidate.solutionCommands);
  const run = (await db.query("select * from public.daily_generation_runs where id=$1", [publicRow.generation_run_id])).rows[0];
  assert.equal(run.status, "validated");
  assert.equal(run.generation_method, "procedural-v1");
  assert.equal(run.candidate_id, easy.id);
  assert.equal(run.mechanics_signature, easy.novelty.mechanicsHash);
  assert.deepEqual(run.quality_metrics, easy.certificate);
  assert.equal(run.story_source, "template");

  const retry = await publish("2099-01-01", () => "hard");
  assert.deepEqual(retry, { status: "already-published", id: first.id, difficulty: "easy" });
  assert.equal((await db.query("select count(*)::int as count from public.daily_puzzles where published_on='2099-01-01' and is_current")).rows[0].count, 1);
  assert.equal((await db.query("select consumed_on::text from public.daily_certified_candidates where id=$1", [easy.id])).rows[0].consumed_on.toString().slice(0, 10), "2099-01-01");

  const empty = await publish("2099-02-02", () => "hard");
  assert.deepEqual(empty, { status: "awaiting-candidate", date: "2099-02-02", difficulty: "hard" });
  assert.equal((await db.query("select selected_difficulty from public.daily_generation_briefs where published_on='2099-02-02'")).rows[0].selected_difficulty, "hard");
  assert.deepEqual((await register(hard)).rows[0].result, { inserted: 1, skipped: 0 });
  const resumed = await publish("2099-02-02", () => "easy");
  assert.deepEqual(resumed, { status: "published", id: "daily-2099-02-02", difficulty: "hard", source: "procedural", storySource: "template" });
  assert.equal((await db.query("select candidate_id from public.daily_generation_briefs where published_on='2099-02-02'")).rows[0].candidate_id, hard.id);

  await assert.rejects(() => roleQuery("anon", "select * from public.daily_puzzle_private"), /permission denied|row-level security/i);
  console.log("Procedural publication integration passed: actual migration chain and SQL RPC, private proof separation, par metadata, run/story metadata, same-date retry, empty-queue refill/resume, and anon privacy. Hosted concurrency was not tested.");
} finally {
  await db.close();
}

function createPGliteServiceClient(database) {
  const runAsService = async query => {
    await database.exec("set role service_role");
    try { return await query(); } finally { await database.exec("reset role"); }
  };
  return {
    from(table) { return new QueryBuilder(database, runAsService, table); },
    async rpc(name, args) {
      const params = Object.values(args);
      const placeholders = params.map((_, index) => `$${index + 1}`).join(",");
      const result = await runAsService(() => database.query(`select public.${name}(${placeholders}) as data`, params));
      return { data: result.rows[0]?.data ?? null, error: null };
    },
  };
}

function QueryBuilder(database, runAsService, table) {
  this.database = database; this.runAsService = runAsService; this.table = table; this.filters = [];
  this.select = columns => { this.columns = columns; return this; };
  this.eq = (column, value) => { this.filters.push([column, value]); return this; };
  this.insert = values => { this.operation = "insert"; this.values = values; return this; };
  this.update = values => { this.operation = "update"; this.values = values; return this; };
  this.maybeSingle = () => this.execute("maybeSingle");
  this.single = () => this.execute("single");
  this.then = (resolve, reject) => this.execute().then(resolve, reject);
  this.execute = async mode => {
    try {
      const result = await this.runAsService(async () => {
        if (this.operation === "insert") {
          const keys = Object.keys(this.values), slots = keys.map((_, i) => `$${i + 1}`);
          return this.database.query(`insert into public.${this.table} (${keys.join(",")}) values (${slots.join(",")}) returning ${this.columns ?? "*"}`,
            keys.map(key => jsonValue(this.values[key])));
        }
        const where = this.filters.map(([key], i) => `${key}=$${i + 1}`);
        const values = this.filters.map(([, value]) => value);
        if (this.operation === "update") {
          const entries = Object.entries(this.values), sets = entries.map(([key], i) => `${key}=$${this.filters.length + i + 1}`);
          return this.database.query(`update public.${this.table} set ${sets.join(",")} where ${where.join(" and ")}`,
            [...values, ...entries.map(([, value]) => jsonValue(value))]);
        }
        return this.database.query(`select ${this.columns ?? "*"} from public.${this.table}${where.length ? ` where ${where.join(" and ")}` : ""}`, values);
      });
      const rows = result.rows ?? [];
      if (mode === "single" && rows.length !== 1) throw new Error("Expected one SQL row.");
      return { data: mode ? rows[0] ?? null : rows, error: null };
    } catch (error) { return { data: null, error }; }
  };
}

function jsonValue(value) { return value !== null && typeof value === "object" ? JSON.stringify(value) : value; }
