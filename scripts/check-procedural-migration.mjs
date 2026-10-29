import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Isolated SQL-only verification. No hosted database or network is contacted.
// npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.12
// node scripts/check-procedural-migration.mjs
const localRequire = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
const { PGlite } = localRequire("@electric-sql/pglite");
const db = new PGlite();
const migrationPath = resolve("supabase/migrations/20261029162003_procedural_daily_candidate_queue.sql");
const fp = number => Number(number).toString(16).padStart(64, "0");
const defaultSource = fp(1000);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.daily_generation_briefs (
      published_on date primary key, selected_difficulty text not null, seed text not null,
      brief_version integer not null, prompt_version integer not null, brief jsonb not null,
      created_at timestamptz not null default now()
    );
    create table public.daily_generation_runs (
      id uuid primary key, published_on date not null, status text not null
    );
    create table public.daily_puzzles (
      id text primary key, published_on date not null, is_current boolean not null default true,
      difficulty text not null
    );
    create table public.daily_puzzle_private (puzzle_id text primary key references public.daily_puzzles(id), solution_commands jsonb not null);
  `);
  await db.exec(await readFile(migrationPath, "utf8"));

  const makeArtifact = ({ id, difficulty = "medium", source = defaultSource, mechanics = id, core = fp(2000), pattern = "merge" }) => ({
    formatVersion: 1, id,
    candidate: { difficulty },
    certificate: { sourceFingerprint: source, mechanicsDigest: id },
    novelty: { mechanicsHash: mechanics, decisionCoreHash: core, commandPattern: pattern },
  });
  const insertCandidate = async ({ key = 1, id = fp(key), difficulty = "medium", source = defaultSource, mechanics = fp(1000 + key), core = fp(2000 + key), pattern = "merge", createdAt } = {}) => {
    const artifact = makeArtifact({ id, difficulty, source, mechanics, core, pattern });
    await db.query(`insert into public.daily_certified_candidates
      (id,difficulty,source_fingerprint,mechanics_hash,decision_core_hash,command_pattern,artifact,created_at)
      values ($1,$2,$3,$4,$5,$6,$7::jsonb,coalesce($8::timestamptz,now()))`,
    [id, difficulty, source, mechanics, core, pattern, JSON.stringify(artifact), createdAt ?? null]);
    await db.query("insert into public.daily_candidate_certificates(candidate_id,source_fingerprint,artifact) values ($1,$2,$3::jsonb)", [id, source, JSON.stringify(artifact)]);
    return artifact;
  };
  const reserve = async (date, difficulty, source = defaultSource) => {
    const result = await db.query("select public.reserve_procedural_daily($1::date,$2,$3) as reservation", [date, difficulty, source]);
    return result.rows[0].reservation;
  };
  const asServiceRole = async callback => {
    await db.exec("set role service_role");
    try { return await callback(); } finally { await db.exec("reset role"); }
  };

  const insertRaw = async (row) => db.query(`insert into public.daily_certified_candidates
    (id,difficulty,source_fingerprint,mechanics_hash,decision_core_hash,command_pattern,artifact)
    values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
  [row.id, row.difficulty ?? row.artifact.candidate.difficulty,
    row.source ?? row.artifact.certificate.sourceFingerprint,
    row.mechanics ?? row.artifact.novelty.mechanicsHash,
    row.core ?? row.artifact.novelty.decisionCoreHash,
    row.pattern ?? row.artifact.novelty.commandPattern, JSON.stringify(row.artifact)]);

  const badId = fp(50);
  await assert.rejects(insertRaw({ id: badId, artifact: makeArtifact({ id: fp(51) }) }));
  await assert.rejects(insertRaw({ id: badId, source: fp(52), artifact: makeArtifact({ id: badId }) }));
  await assert.rejects(insertRaw({ id: badId, difficulty: "hard", artifact: makeArtifact({ id: badId }) }));

  await insertCandidate({ key: 1 });
  await assert.rejects(insertCandidate({ key: 2, mechanics: fp(1001) }));
  await assert.rejects(insertCandidate({ key: 3, core: fp(2001) }));
  await assert.rejects(db.query("update public.daily_certified_candidates set source_fingerprint=$2 where id=$1", [fp(1), fp(52)]));
  await assert.rejects(db.query("update public.daily_certified_candidates set artifact='{}'::jsonb where id=$1", [fp(1)]));

  // Empty reservation persists difficulty and seed; a later retry may fill that same bucket.
  const emptySource = fp(1007);
  const empty = await reserve("2099-01-01", "medium", emptySource);
  assert.deepEqual(empty, { date: "2099-01-01", difficulty: "medium" });
  const savedBrief = (await db.query("select selected_difficulty,seed,brief from public.daily_generation_briefs where published_on='2099-01-01'")).rows[0];
  assert.equal(savedBrief.selected_difficulty, "medium");
  const later = await insertCandidate({ key: 4, difficulty: "medium", source: emptySource, pattern: "rebase" });
  const attached = await reserve("2099-01-01", "hard", emptySource);
  assert.equal(attached.difficulty, "medium");
  assert.deepEqual(attached.artifact, later);
  assert.deepEqual(await reserve("2099-01-01", "hard", emptySource), attached);
  assert.equal((await db.query("select consumed_on from public.daily_certified_candidates where id=$1", [fp(4)])).rows[0].consumed_on.toISOString().slice(0, 10), "2099-01-01");
  await assert.rejects(db.query("update public.daily_certified_candidates set consumed_on='2099-01-02' where id=$1", [fp(4)]));
  await assert.rejects(db.query("update public.daily_certified_candidates set consumed_on='2099-01-01' where id=$1", [fp(1)]));

  // Source and withdrawal filtering; an unavailable candidate is never substituted from another registry.
  const filteredStore = fp(1001);
  await insertCandidate({ key: 5, source: fp(1002), pattern: "merge" });
  await insertCandidate({ key: 6, source: filteredStore, pattern: "merge" });
  await db.query("update public.daily_certified_candidates set withdrawn_at=now() where id=$1", [fp(6)]);
  const available = await insertCandidate({ key: 7, source: filteredStore, pattern: "rebase" });
  const filtered = await reserve("2099-01-02", "medium", filteredStore);
  assert.deepEqual(filtered.artifact, available);
  assert.equal((await reserve("2099-01-03", "medium", filteredStore)).artifact, undefined);

  // Least-recent command pattern wins when unused candidates have competing history.
  const patternSource = fp(1002);
  await insertCandidate({ key: 8, source: patternSource, pattern: "merge" });
  await insertCandidate({ key: 9, source: patternSource, pattern: "rebase" });
  await insertCandidate({ key: 10, source: patternSource, pattern: "merge" });
  await insertCandidate({ key: 11, source: patternSource, pattern: "merge" });
  await insertCandidate({ key: 15, source: patternSource, pattern: "rebase" });
  await db.query("update public.daily_certified_candidates set consumed_on='2099-01-08' where id=$1", [fp(11)]);
  await db.query("update public.daily_certified_candidates set consumed_on='2099-01-05' where id=$1", [fp(15)]);
  const leastRecent = await reserve("2099-01-10", "medium", patternSource);
  assert.equal(leastRecent.artifact.id, fp(9));
  // Reordering the same operations must not masquerade as a fresh strategy.
  const reorderedSource = fp(1200);
  await insertCandidate({ key: 30, source: reorderedSource, pattern: "merge → revert" });
  await db.query("update public.daily_certified_candidates set consumed_on = '2099-01-20' where id = $1", [fp(30)]);
  await insertCandidate({ key: 31, source: reorderedSource, pattern: "revert → merge", createdAt: "2098-01-01" });
  await insertCandidate({ key: 32, source: reorderedSource, pattern: "switch → merge", createdAt: "2098-01-02" });
  assert.equal((await reserve("2099-01-21", "medium", reorderedSource)).artifact.id, fp(32));

  // A consumed candidate cannot satisfy a second date, while another isolated inventory row can.
  const dateSource = fp(1006);
  const distinctDate = await insertCandidate({ key: 12, source: dateSource, pattern: "cherry-pick" });
  const nextDay = await reserve("2099-01-11", "medium", dateSource);
  assert.deepEqual(nextDay.artifact, distinctDate);
  assert.notEqual(nextDay.artifact.id, leastRecent.artifact.id);
  assert.equal((await reserve("2099-01-14", "medium", dateSource)).artifact, undefined);

  // Existing legacy reservations preserve their selected difficulty and seed.
  await db.query(`insert into public.daily_generation_briefs(published_on,selected_difficulty,seed,brief_version,prompt_version,brief)
    values ('2099-01-12','easy','legacy-seed',2,2,'{}')`);
  const legacy = await reserve("2099-01-12", "hard", fp(1003));
  assert.deepEqual(legacy, { date: "2099-01-12", difficulty: "easy" });
  const legacyBrief = (await db.query("select selected_difficulty,seed from public.daily_generation_briefs where published_on='2099-01-12'")).rows[0];
  assert.deepEqual(legacyBrief, { selected_difficulty: "easy", seed: "legacy-seed" });

  // Published rows short-circuit without reserving or consuming mechanics.
  await insertCandidate({ key: 13, source: fp(1004), pattern: "merge" });
  await db.query("insert into public.daily_puzzles(id,published_on,is_current,difficulty) values ('published-already','2099-01-13',true,'hard')");
  const beforeConsumed = (await db.query("select count(*)::int as count from public.daily_certified_candidates where consumed_on='2099-01-13'")).rows[0].count;
  assert.deepEqual(await reserve("2099-01-13", "easy", fp(1004)), { date: "2099-01-13", difficulty: "hard", publishedId: "published-already" });
  assert.equal((await db.query("select count(*)::int as count from public.daily_generation_briefs where published_on='2099-01-13'")).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.daily_certified_candidates where consumed_on='2099-01-13'")).rows[0].count, beforeConsumed);

  for (const args of [[null, "easy", defaultSource], ["2099-01-14", null, defaultSource], ["2099-01-14", "invalid", defaultSource], ["2099-01-14", "easy", "not-a-fingerprint"]]) {
    await assert.rejects(() => reserve(...args));
  }

  const functionSignature = "public.reserve_procedural_daily(date,text,text)";
  for (const role of ["anon", "authenticated"]) {
    const privileges = (await db.query(`select has_function_privilege($1,$2,'EXECUTE') as execute,
      has_table_privilege($1,'public.daily_certified_candidates','SELECT') as read,
      has_function_privilege($1,'public.register_procedural_candidates(jsonb)','EXECUTE') as register`, [role, functionSignature])).rows[0];
    assert.deepEqual(privileges, { execute: false, read: false, register: false });
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.daily_certified_candidates'::regclass")).rows[0].relrowsecurity, true);
  await asServiceRole(async () => {
    const serviceRow = await insertCandidate({ key: 14, source: fp(1005), pattern: "merge" });
    const serviceReservation = await reserve("2099-01-15", "medium", fp(1005));
    assert.deepEqual(serviceReservation.artifact, serviceRow);
    const registration = makeArtifact({ id: fp(20), mechanics: fp(1020), core: fp(2020), pattern: "rebase" });
    const firstRegistration = (await db.query("select public.register_procedural_candidates($1::jsonb) as result", [JSON.stringify([registration])])).rows[0].result;
    const retryRegistration = (await db.query("select public.register_procedural_candidates($1::jsonb) as result", [JSON.stringify([registration])])).rows[0].result;
    assert.deepEqual(firstRegistration, { inserted: 1, skipped: 0 });
    assert.deepEqual(retryRegistration, { inserted: 0, skipped: 1 });

    // Upgrade evidence without changing identity, losing the old certificate,
    // or rerolling a date already reserved under an earlier evaluator.
    const upgradeSource = fp(3000);
    const upgradeDate = "2099-02-01";
    const beforeUpgrade = await reserve(upgradeDate, "medium", defaultSource);
    const candidateId = beforeUpgrade.artifact.id;
    const waiting = await reserve(upgradeDate, "hard", upgradeSource);
    assert.equal(waiting.difficulty, "medium");
    assert.equal(waiting.candidateId, candidateId);
    assert.equal(waiting.artifact, null);
    const stale = (await db.query("select public.stale_daily_candidates($1,'medium','') as items", [upgradeSource])).rows[0].items;
    assert(stale.some(row => row.id === candidateId && row.reserved_date === upgradeDate));
    const renewed = structuredClone(beforeUpgrade.artifact);
    renewed.certificate.sourceFingerprint = upgradeSource;
    const upgraded = (await db.query("select public.register_procedural_candidates($1::jsonb) as result", [JSON.stringify([renewed])])).rows[0].result;
    assert.deepEqual(upgraded, { inserted: 1, skipped: 0 });
    assert.deepEqual((await reserve(upgradeDate, "hard", upgradeSource)).artifact, renewed);
    assert.equal((await db.query("select count(*)::int as count from public.daily_candidate_certificates where candidate_id=$1", [candidateId])).rows[0].count, 2);
    assert.deepEqual((await reserve(upgradeDate, "medium", defaultSource)).artifact, beforeUpgrade.artifact);
    const changed = structuredClone(renewed);
    changed.certificate.sourceFingerprint = fp(3001);
    changed.candidate.title = "Changed immutable candidate";
    await assert.rejects(db.query("select public.register_procedural_candidates($1::jsonb)", [JSON.stringify([changed])]));
    await assert.rejects(db.query("update public.daily_candidate_certificates set artifact='{}'::jsonb where candidate_id=$1", [candidateId]));
    await assert.rejects(db.query("delete from public.daily_candidate_certificates where candidate_id=$1", [candidateId]));
  });

  for (const role of ["anon", "authenticated"]) {
    assert.equal((await db.query("select has_table_privilege($1,'public.daily_candidate_certificates','SELECT') as allowed", [role])).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege($1,'public.stale_daily_candidates(text,text,text)','EXECUTE') as allowed", [role])).rows[0].allowed, false);
  }

  console.log("Procedural SQL migration passed: candidate constraints, immutable identity, source/withdrawal filtering, persisted reservations, fairness ordering, publication short-circuit, and role protections.");
} finally {
  await db.close();
}
