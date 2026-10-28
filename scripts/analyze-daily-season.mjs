import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { resolve } from "node:path";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";

// Read-only season simulation over a fixed local certified batch. No network or UI calls.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i++) {
  if (!["--days", "--seed", "--seasons"].includes(args[i]) || args[i + 1] === undefined) throw new Error("Usage: node scripts/analyze-daily-season.mjs [--days 90] [--seed season-2026-10-28] [--seasons 1]");
  options.set(args[i], args[++i]);
}
const integer = (key, fallback, min, max) => {
  const value = Number(options.get(key) ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}.`);
  return value;
};
const daysPerSeason = integer("--days", 90, 1, 3660);
const seasons = integer("--seasons", 1, 1, 20);
const seed = options.get("--seed") ?? "season-2026-10-28";
function pickDifficulty(date, seasonIndex) {
  let counter = 0;
  while (true) {
    const digest = createHash("sha256").update(`${seed}|${seasonIndex}|${date}|${counter++}`).digest();
    const n = digest.readUInt32BE(0);
    if (n === 0xffffffff) continue;
    return ["easy", "medium", "hard"][n % 3];
  }
}
const startDate = new Date("2026-10-28T00:00:00Z");
const plannedDates = [];
let globalDay = 0;
for (let seasonIndex = 0; seasonIndex < seasons; seasonIndex++) for (let dayIndex = 0; dayIndex < daysPerSeason; dayIndex++, globalDay++) {
  const date = new Date(startDate); date.setUTCDate(date.getUTCDate() + globalDay);
  const dateString = date.toISOString().slice(0, 10);
  plannedDates.push({ season: seasonIndex + 1, seasonIndex, globalDay, date: dateString, difficulty: pickDifficulty(dateString, seasonIndex) });
}
const requiredCounts = Object.fromEntries(["easy", "medium", "hard"].map(d => [d, plannedDates.filter(item => item.difficulty === d).length]));
console.log(JSON.stringify({ seasonSemantics: "seasons are consecutive non-overlapping blocks of --days dates", seasons, daysPerSeason, totalDates: plannedDates.length, seed, requiredPerDifficultyForThisSeededSchedule: requiredCounts }, null, 2));
const sourceFingerprint = await dailyCertificateSource();
const manifest = JSON.parse(await readFile("src/puzzles/generation/proceduralManifest.json", "utf8"));
if (manifest.sourceFingerprint !== sourceFingerprint) throw new Error("Procedural manifest is stale; run pnpm daily:check before analysis.");

const localRequire = createRequire(resolve("daily-review.local/sql-runtime/package.json"));
const { PGlite } = localRequire("@electric-sql/pglite");
const db = new PGlite();
const migration = await readFile("supabase/migrations/20261028071144_procedural_daily_candidate_queue.sql", "utf8");
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create table public.daily_generation_briefs (
    published_on date primary key, selected_difficulty text not null, seed text not null,
    brief_version integer not null, prompt_version integer not null, brief jsonb not null,
    created_at timestamptz not null default now());
  create table public.daily_generation_runs (id uuid primary key, published_on date not null, status text not null);
  create table public.daily_puzzles (id text primary key, published_on date not null, is_current boolean not null default true, difficulty text not null);
  create table public.daily_puzzle_private (puzzle_id text primary key references public.daily_puzzles(id), solution_commands jsonb not null);`);
await db.exec(migration);

const files = await readdir("daily-review.local/candidate-reserve").catch(() => []);
const rawArtifacts = [];
for (const filename of files.filter(name => /^[a-f0-9]{64}\.private\.json$/.test(name))) {
  const raw = JSON.parse(await readFile(resolve("daily-review.local/candidate-reserve", filename), "utf8"));
  if (raw?.certificate?.sourceFingerprint === sourceFingerprint) rawArtifacts.push(raw);
}
const compiled = await build({ stdin: { contents: "export * from './src/puzzles/generation/candidateArtifact';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "node" });
const verifier = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const artifacts = [];
for (const raw of rawArtifacts) artifacts.push(await verifier.verifyCandidateArtifact(raw, { sourceFingerprint }));
const counts = Object.fromEntries(["easy", "medium", "hard"].map(d => [d, artifacts.filter(a => a.candidate.difficulty === d).length]));
const requested = daysPerSeason * seasons;
console.log(JSON.stringify({ sourceFingerprint, verifiedCurrentSourceArtifacts: counts }, null, 2));

// Real RPC registration and reservation ordering run against an isolated PGlite DB.
await db.exec("set role service_role");
try {
  for (let offset = 0; offset < artifacts.length; offset += 20) {
    await db.query("select public.register_procedural_candidates($1::jsonb)", [JSON.stringify(artifacts.slice(offset, offset + 20))]);
  }
} finally { await db.exec("reset role"); }

const schedule = [], strategyLastSeen = new Map();
for (const { season, globalDay, date: dateString, difficulty } of plannedDates) {
    const result = (await db.query("select public.reserve_procedural_daily($1::date,$2,$3) as reservation", [dateString, difficulty, sourceFingerprint])).rows[0].reservation;
    if (result.artifact) {
      const a = result.artifact;
      const publicId = `daily-${dateString}`;
      await db.query("insert into public.daily_puzzles(id,published_on,is_current,difficulty) values ($1,$2,true,$3)", [publicId, dateString, difficulty]);
      const retryDifficulty = difficulty === "easy" ? "hard" : "easy";
      const retry = (await db.query("select public.reserve_procedural_daily($1::date,$2,$3) as reservation", [dateString, retryDifficulty, sourceFingerprint])).rows[0].reservation;
      if (retry.publishedId !== publicId) throw new Error(`Published retry did not return the same public ID for ${dateString}.`);
      const key = (await db.query("select public.daily_strategy_key($1) as key", [a.novelty.commandPattern])).rows[0].key;
      const previous = strategyLastSeen.get(key);
      strategyLastSeen.set(key, globalDay);
      schedule.push({ season, date: dateString, difficulty, publicId, candidateId: a.id, mechanicsHash: a.novelty.mechanicsHash, decisionCoreHash: a.novelty.decisionCoreHash, strategy: key, proofLength: a.certificate.proofCommands, previousStrategyDistanceDays: previous === undefined ? null : globalDay - previous });
    } else {
      schedule.push({ season, date: dateString, difficulty, status: "shortage", candidateId: null });
    }
}
const successes = schedule.filter(row => row.candidateId);
const unique = key => new Set(successes.map(row => row[key])).size;
const strategyCounts = Object.fromEntries([...new Set(successes.map(row => row.strategy))].map(key => [key, successes.filter(row => row.strategy === key).length]).sort((a, b) => b[1] - a[1]));
const distances = schedule.filter(row => Number.isInteger(row.previousStrategyDistanceDays)).map(row => row.previousStrategyDistanceDays);
const uniqueMechanicsCount = unique("mechanicsHash"), uniqueDecisionCoreCount = unique("decisionCoreHash");
const report = {
  limitation: "Simulation of this fixed certified artifact batch through the real migration RPC in isolated PGlite; not a simulation of CI refill throughput or staging publication.",
  sourceFingerprint, seed, seasons, seasonSemantics: "seasons are consecutive non-overlapping blocks of --days dates", daysPerSeason, totalDates: requested,
  requiredPerDifficultyForThisSeededSchedule: requiredCounts, initialVerifiedCurrentSourceCounts: counts,
  shortages: schedule.filter(row => row.status === "shortage").map(({ season, date, difficulty }) => ({ season, date, difficulty })),
  publishedSimulated: successes.length,
  uniqueMechanicsCount, uniqueDecisionCoreCount,
  strategyCounts, strategyConcentration: successes.length ? Math.max(0, ...Object.values(strategyCounts)) / successes.length : 0,
  repeatedStrategyDistancesDays: distances,
  proofLengths: successes.map(({ date, difficulty, proofLength }) => ({ date, difficulty, proofLength })),
  schedule,
};
await mkdir("daily-review.local", { recursive: true });
await writeFile("daily-review.local/season-analysis.local.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ publishedSimulated: report.publishedSimulated, shortages: report.shortages.length, uniqueMechanicsCount: report.uniqueMechanicsCount, uniqueDecisionCoreCount: report.uniqueDecisionCoreCount, strategyCounts, report: "daily-review.local/season-analysis.local.json" }, null, 2));
await db.close();
if (report.shortages.length || uniqueMechanicsCount !== successes.length || uniqueDecisionCoreCount !== successes.length) {
  console.error("Season acceptance failed: shortages or repeated mechanics/decision cores were found. See the report for details.");
  process.exitCode = 1;
}
