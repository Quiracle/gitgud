import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const connectionString = process.env.DAILY_SQL_TEST_URL;
if (!connectionString) throw new Error("Set DAILY_SQL_TEST_URL to a fresh local PostgreSQL URL for database gitgud_generation_check.");
const parsed = new URL(connectionString);
if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.search ||
    !["localhost", "127.0.0.1"].includes(parsed.hostname) || decodeURIComponent(parsed.pathname.slice(1)) !== "gitgud_generation_check") {
  throw new Error("Refusing non-local SQL target. Host must be localhost or 127.0.0.1 and database must be gitgud_generation_check.");
}
const localRequire = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
let Client;
try { ({ Client } = localRequire("pg")); }
catch { throw new Error("Install the optional PostgreSQL client: npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false pg@8.13.1"); }

// SQL fixtures below are synthetic queue payloads, not Git engine certificates.
const observer = new Client({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: 25_000 });
const clients = [];
const pendingQueries = new Set();
const track = promise => {
  pendingQueries.add(promise);
  promise.finally(() => pendingQueries.delete(promise)).catch(() => {});
  return promise;
};
const connect = async () => {
  const client = new Client({ connectionString, connectionTimeoutMillis: 5_000, statement_timeout: 25_000 });
  await client.connect();
  client.backendPid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
  clients.push(client);
  return client;
};
const lockWaitTimeoutMs = 15_000;
const migrationFiles = [
  "202610090001_ai_daily_generation.sql",
  "202610100001_generation_quality_metrics.sql",
  "202610110002_daily_par_commands.sql",
  "20261027000007_deterministic_daily_generation.sql",
  "20261028071144_procedural_daily_candidate_queue.sql",
];

try {
  await observer.connect();
  const existing = await observer.query("select tablename from pg_tables where schemaname='public' and tablename = any($1)", [["daily_generation_briefs", "daily_generation_runs", "daily_puzzles", "daily_puzzle_private", "daily_certified_candidates"]]);
  assert.equal(existing.rowCount, 0, "Target database must be fresh; refusing to reuse daily-generation tables.");
  await observer.query(`do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role bypassrls; exception when duplicate_object then null; end $$;`);
  for (const file of migrationFiles) {
    const sql = await readFile(resolve("supabase/migrations", file), "utf8");
    await observer.query(sql);
  }

  const roleQuery = async (client, role, sql, values = []) => {
    await client.query(`set role ${role}`);
    try { return await client.query(sql, values); } finally { await client.query("reset role"); }
  };
  const fp = n => Number(n).toString(16).padStart(64, "0");
  const artifact = (n, difficulty = "easy") => ({
    formatVersion: 1, id: fp(n), candidate: { difficulty },
    certificate: { sourceFingerprint: fp(999), mechanicsDigest: fp(n) },
    novelty: { mechanicsHash: fp(1000 + n), decisionCoreHash: fp(2000 + n), commandPattern: "switch → merge" },
  });
  const artifacts = [artifact(1), artifact(2), artifact(3), artifact(4), artifact(5, "hard")];
  await roleQuery(observer, "service_role", "select public.register_procedural_candidates($1::jsonb)", [JSON.stringify(artifacts)]);
  const reserve = (client, date, difficulty) => roleQuery(client, "service_role", "select public.reserve_procedural_daily($1::date,$2,$3) as value", [date, difficulty, fp(999)]).then(r => r.rows[0].value);
  const waitForLock = async blockedClient => {
    const processId = blockedClient.backendPid;
    const until = Date.now() + lockWaitTimeoutMs;
    while (Date.now() < until) {
      const result = await observer.query("select wait_event_type from pg_stat_activity where pid=$1", [processId]);
      if (result.rows[0]?.wait_event_type === "Lock") return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error("Timed out waiting for PostgreSQL to report the expected lock wait.");
  };

  // Rollback must release both the daily reservation and candidate consumption.
  const rollbackClient = await connect();
  await rollbackClient.query("begin");
  const rolled = await reserve(rollbackClient, "2099-01-01", "easy");
  assert(rolled.candidateId);
  await rollbackClient.query("rollback");
  assert.equal((await observer.query("select count(*)::int as n from public.daily_generation_briefs where published_on='2099-01-01'")).rows[0].n, 0);
  assert.equal((await observer.query("select consumed_on from public.daily_certified_candidates where id=$1", [rolled.candidateId])).rows[0].consumed_on, null);

  // Same-date contenders must block on the advisory lock and reuse the persisted category/candidate.
  const sameA = await connect(), sameB = await connect();
  await sameA.query("begin"); await sameB.query("begin");
  const sameFirst = await reserve(sameA, "2099-01-02", "easy");
  const samePending = track(reserve(sameB, "2099-01-02", "hard"));
  await waitForLock(sameB);
  await sameA.query("commit");
  const sameSecond = await samePending;
  await sameB.query("commit");
  assert.equal(sameFirst.difficulty, "easy");
  assert.equal(sameSecond.difficulty, "easy");
  assert.equal(sameSecond.candidateId, sameFirst.candidateId);

  // Different dates can proceed concurrently; SKIP LOCKED must allocate distinct candidates.
  const diffA = await connect(), diffB = await connect();
  await diffA.query("begin"); await diffB.query("begin");
  const diffFirst = await reserve(diffA, "2099-01-03", "easy");
  const diffPending = track(reserve(diffB, "2099-01-04", "easy"));
  const diffSecond = await Promise.race([diffPending, timeout(5_000, "Different-date reservation blocked unexpectedly.")]);
  assert.notEqual(diffSecond.candidateId, diffFirst.candidateId);
  await diffB.query("commit"); await diffA.query("commit");

  // Race the real publication RPC. The unique date constraint elects one immutable winner.
  const pubA = await connect(), pubB = await connect();
  const publicationReservation = await reserve(observer, "2099-01-05", "easy");
  assert(publicationReservation.candidateId);
  const runs = await Promise.all(["2099-01-05", "2099-01-05"].map(date => observer.query(`insert into public.daily_generation_runs
    (published_on,selected_difficulty,status,attempt_number,brief_version,prompt_version,provider,generation_method,candidate_id)
    values ($1,'easy','running',1,4,3,'deterministic','procedural-v1',$2) returning id`, [date, publicationReservation.candidateId])));
  const [runA, runB] = runs.map(r => r.rows[0].id);
  const definition = id => ({ id, slug: id, kind: "daily", version: 1, publishedOn: "2099-01-05", difficulty: "easy", schemaVersion: 1, parCommands: 2, title: "race", description: "race", initialRepository: {}, target: {}, allowedCommands: [] });
  await pubA.query("begin"); await pubB.query("begin");
  const publishCall = (client, runId, id) => roleQuery(client, "service_role", "select public.publish_daily_puzzle($1::uuid,$2::jsonb,$3::jsonb,'validated') as id", [runId, JSON.stringify(definition(id)), JSON.stringify(["git switch main"])]).then(r => r.rows[0].id);
  const publishedA = await publishCall(pubA, runA, "daily-2099-01-05-a");
  const publishPending = track(publishCall(pubB, runB, "daily-2099-01-05-b"));
  await waitForLock(pubB);
  await pubA.query("commit");
  const publishedB = await publishPending;
  await pubB.query("commit");
  assert.equal(publishedB, publishedA);
  assert.equal((await observer.query("select count(*)::int as n from public.daily_puzzles where published_on='2099-01-05' and is_current")).rows[0].n, 1);
  assert.equal((await observer.query("select count(*)::int as n from public.daily_puzzle_private where puzzle_id=$1", [publishedA])).rows[0].n, 1);
  const runStates = (await observer.query("select id,status from public.daily_generation_runs where id=any($1::uuid[])", [[runA, runB]])).rows;
  assert.equal(runStates.filter(row => row.status === "validated").length, 1);
  assert.equal(runStates.filter(row => row.status === "superseded").length, 1);

  const anon = await connect();
  await anon.query("set role anon");
  await assert.rejects(anon.query("select * from public.daily_puzzle_private"), /permission denied|row-level security/i);
  await anon.query("reset role");
  console.log("Local PostgreSQL concurrency check passed: same-date reservation, distinct SKIP LOCKED consumption, rollback safety, racing publication winner, and private-row denial. This tests SQL only, not hosted Edge behavior.");
} finally {
  await Promise.allSettled(clients.map(client => client.query("rollback")));
  await Promise.allSettled([...pendingQueries]);
  await Promise.all(clients.map(client => client.end().catch(() => {})));
  await observer.end().catch(() => {});
}

function timeout(milliseconds, message) { return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)); }
