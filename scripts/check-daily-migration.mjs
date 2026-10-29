import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";

// Optional, isolated SQL verification. No production connection or application dependency.
// npm install --prefix daily-review.local/sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.12
// node scripts/check-daily-migration.mjs
const localRequire = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
const { PGlite } = localRequire("@electric-sql/pglite");
const db = new PGlite();
try {
  // Minimal predecessor schema with the actual reservation/run columns used by this migration.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.daily_generation_briefs (
      published_on date primary key, selected_difficulty text not null,
      seed text not null, brief_version integer not null, prompt_version integer not null,
      brief jsonb not null, created_at timestamptz not null default now()
    );
    create table public.daily_generation_runs (id uuid primary key default gen_random_uuid(), published_on date not null, status text not null);
  `);
  await db.exec(await readFile(resolve("supabase/migrations/20261029161959_deterministic_daily_generation.sql"), "utf8"));
  const fingerprint = "a".repeat(64);
  const reserve = async (date, difficulty, seed, template, certificate = fingerprint) => {
    const result = await db.query("select public.reserve_deterministic_daily($1::date,$2,$3,$4,$5) as reservation", [date, difficulty, seed, template, certificate]);
    return result.rows[0].reservation;
  };
  await db.query("insert into public.daily_mechanics_reserve(difficulty, seed, template_id, certification) values ('medium','prepared','medium-5',$1), ('medium','stale','medium-5',$2), ('hard','other','hard-5',$1)", [fingerprint, "b".repeat(64)]);
  const first = await reserve("2099-01-01", "medium", "proposed", "medium-5");
  assert.equal(first.seed, "prepared");
  assert.equal(first.selected_difficulty, "medium");
  assert.equal(first.brief.templateId, "medium-5");
  assert.deepEqual(await reserve("2099-01-01", "hard", "retry", "hard-5"), first);
  assert.equal((await db.query("select count(*)::int as count from public.daily_mechanics_reserve where consumed_on is not null")).rows[0].count, 1);
  assert.equal((await reserve("2099-01-02", "medium", "direct", "medium-5")).seed, "direct");
  assert.equal((await reserve("2099-01-03", "hard", "ignored", "hard-5")).seed, "other");

  // Legacy reservations keep their original category and seed.
  await db.query("insert into public.daily_generation_briefs(published_on,selected_difficulty,seed,brief_version,prompt_version,brief) values ('2099-01-04','easy','legacy',2,2,'{}')");
  const legacy = await reserve("2099-01-04", "medium", "new", "medium-5");
  assert.equal(legacy.seed, "legacy");
  assert.equal(legacy.selected_difficulty, "easy");
  for (const args of [[null,"easy","s","easy-0"], ["2099-01-05",null,"s","easy-0"], ["2099-01-05","easy","s",null], ["2099-01-05","easy","s","hard-5"]]) {
    await assert.rejects(() => reserve(...args), /Invalid deterministic daily reservation/);
  }
  const signature = "public.reserve_deterministic_daily(date,text,text,text,text)";
  for (const role of ["anon", "authenticated"]) {
    const privileges = (await db.query("select has_function_privilege($1,$2,'EXECUTE') as execute, has_table_privilege($1,'public.daily_mechanics_reserve','SELECT') as read", [role, signature])).rows[0];
    assert.deepEqual(privileges, { execute: false, read: false });
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.daily_mechanics_reserve'::regclass")).rows[0].relrowsecurity, true);
  await db.exec("set role service_role");
  assert.equal((await reserve("2099-01-06", "easy", "service", "easy-0")).seed, "service");
  await db.exec("reset role");
  console.log("SQL migration passed: reserve selection, certification filtering, idempotent retries, legacy retention, input validation, RLS and role privileges.");
  console.log("This single-connection test does not simulate concurrent hosted transactions; production publication has not been changed.");
} finally {
  await db.close();
}
