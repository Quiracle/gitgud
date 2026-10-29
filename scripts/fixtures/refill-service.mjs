import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const { verifyCandidateArtifact } = await import(pathToFileURL(process.env.WORKER_CHECK_DOMAIN).href);
const require = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
const { old, spare, source } = JSON.parse(await readFile(process.env.WORKER_CHECK_FIXTURES, "utf8"));
const mode = process.env.WORKER_CHECK_MODE;
const reserved = mode === "reserved" || mode === "incompatible";
if (mode === "incompatible") old.candidate.solutionCommands = ["git unsupported-in-new-engine"];
await db.exec([
  "create role anon; create role authenticated; create role service_role bypassrls;",
  "create table public.daily_generation_briefs (published_on date primary key, selected_difficulty text not null, seed text not null, brief_version integer not null, prompt_version integer not null, brief jsonb not null);",
  "create table public.daily_generation_runs (id uuid primary key, published_on date not null, status text not null);",
  "create table public.daily_puzzles (id text primary key, published_on date not null, is_current boolean not null default true, difficulty text not null);",
  "create table public.daily_puzzle_private (puzzle_id text primary key references public.daily_puzzles(id), solution_commands jsonb not null);",
].join("\n"));
await db.exec(await readFile("supabase/migrations/20261029162003_procedural_daily_candidate_queue.sql", "utf8"));
await db.exec("set role service_role");
if (mode !== "fresh") await db.query("select public.register_procedural_candidates($1::jsonb)", [JSON.stringify([old])]);
if (reserved) {
  await db.query("select public.reserve_procedural_daily('2099-02-01','easy',$1)", [old.certificate.sourceFingerprint]);
  await db.query("select public.register_procedural_candidates($1::jsonb)", [JSON.stringify([spare])]);
}
const calls = [];
let registeredId;
async function saveResult() {
  const certificates = (await db.query("select count(*)::int as count from public.daily_candidate_certificates where candidate_id=$1", [registeredId ?? old.id])).rows[0].count;
  const retry = reserved ? (await db.query("select public.reserve_procedural_daily('2099-02-01','hard',$1) as reservation", [source])).rows[0].reservation : null;
  await writeFile(resolve(process.env.DAILY_REFILL_OUTPUT_DIRECTORY, "service-result.private.json"), JSON.stringify({ calls, certificates, retry, registeredId }));
}
globalThis.fetch = async (url, init) => {
  assert.equal(url, "https://worker-check.invalid/generate");
  assert.equal(init.headers["x-generation-secret"], "test-only-secret");
  const body = JSON.parse(init.body);
  calls.push(body.mode);
  let result;
  if (body.mode === "published-history") result = { entries: [], next: null };
  else if (body.mode === "inventory") result = { entries: (await db.query("select id, mechanics_hash, decision_core_hash from public.daily_certified_candidates order by id")).rows, next: null };
  else if (body.mode === "stale-candidates") result = { entries: (await db.query("select public.stale_daily_candidates($1,$2,$3) as items", [source, body.difficulty, body.after ?? ""])).rows[0].items, next: null };
  else if (body.mode === "preflight") {
    const rows = (await db.query("select candidate.difficulty, candidate.strategy_key from public.daily_certified_candidates candidate join public.daily_candidate_certificates certificate on certificate.candidate_id=candidate.id where certificate.source_fingerprint=$1 and candidate.consumed_on is null and candidate.withdrawn_at is null", [source])).rows;
    const reserveCounts = { easy: 0, medium: 0, hard: 0 }, strategyCounts = { easy: {}, medium: {}, hard: {} };
    for (const row of rows) {
      reserveCounts[row.difficulty]++;
      strategyCounts[row.difficulty][row.strategy_key] = (strategyCounts[row.difficulty][row.strategy_key] ?? 0) + 1;
    }
    result = { reserveCounts, strategyCounts };
  } else if (body.mode === "register-candidates") {
    for (const item of body.artifacts) await verifyCandidateArtifact(item, { sourceFingerprint: source });
    result = (await db.query("select public.register_procedural_candidates($1::jsonb) as result", [JSON.stringify(body.artifacts)])).rows[0].result;
    registeredId = body.artifacts[0].id;
    await saveResult();
  } else throw new Error("Unexpected worker service mode: " + body.mode);
  return new Response(JSON.stringify({ ...result, certification: source }), { status: 200 });
};
let closed = false;
process.on("beforeExit", async () => { if (!closed) { closed = true; await saveResult(); await db.close(); } });
