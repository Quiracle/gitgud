import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

process.on("uncaughtException", error => { console.error(error.message); process.exit(1); });
const [difficulty = "hard", countText = "20", offsetText = "0"] = process.argv.slice(2);
const count = Number(countText), offset = Number(offsetText);
if (!["easy", "medium", "hard"].includes(difficulty) || !Number.isInteger(count) || count < 1 || count > 1000 || !Number.isInteger(offset) || offset < 0) throw new Error("Usage: node scripts/synthesize-dailies.mjs easy|medium|hard [1..1000] [offset]");
const compiled = await build({ stdin: {
  contents: "export * from './src/puzzles/generation/synthesis'; export * from './src/puzzles/generation/proceduralCertification'; export * from './src/puzzles/generation/proceduralQuality'; export * from './src/puzzles/generation/novelty'; export * from './src/puzzles/generation/decisionCore';",
  resolveDir: process.cwd(), loader: "ts",
}, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const sourceFingerprint = createHash("sha256").update(compiled.outputFiles[0].text).digest("hex");
const report = { sourceFingerprint, difficulty, count, offset, attempted: 0, noProof: 0, tooShort: 0, shortcuts: 0, unknown: 0, copyOnly: 0, duplicates: 0, qualified: [], elapsedMs: 0 };
const cores = new Set();
const started = Date.now();
await mkdir("daily-review.local/synthesis", { recursive: true });
for (let i = offset; i < offset + count; i++) {
  const seed = `synthesis-${i}`;
  const { candidate, discovery, rejection } = domain.synthesizeDailyCandidate("2030-01-01", difficulty, seed, { maxElapsedMs: 8000, maxTransitions: 50_000 });
  report.attempted++;
  let status = "no-proof";
  if (rejection === "too-short") { report.tooShort++; status = "too-short"; }
  else if (!candidate) report.noProof++;
  else if (candidate.solutionCommands.length < { easy: 2, medium: 4, hard: 6 }[difficulty]) { report.tooShort++; status = "too-short"; }
  else if (difficulty !== "easy" && (domain.findCopyOnlySolution(candidate) || domain.proofHasSequentialCopies(candidate))) { report.copyOnly++; status = "copy-only"; }
  else {
    const core = domain.fingerprintDecisionCore(candidate);
    if (cores.has(core)) { report.duplicates++; status = "duplicate"; }
    else {
      const search = domain.certifyProceduralBatch([candidate], { maxDepth: candidate.solutionCommands.length - 1, maxElapsedMs: 60_000, maxTransitions: 1_000_000 });
      status = search.verdicts[0].status;
      if (status === "shortcut") report.shortcuts++;
      else if (status === "unknown") report.unknown++;
      else {
        cores.add(core);
        report.qualified.push({ seed, candidate, discovery, core: createHash("sha256").update(core).digest("hex"), pattern: domain.solutionCommandPattern(candidate), search: { excludedThroughDepth: search.excludedThroughDepth, transitions: search.transitions, exploredStates: search.exploredStates } });
      }
    }
  }
  report.elapsedMs = Date.now() - started;
  console.log(`${difficulty} ${i}: ${status}; discovery ${discovery.transitions} transitions${candidate ? `; ${candidate.solutionCommands.join(" / ").replaceAll("\n", "; ")}` : ""}`);
  await writeFile(`daily-review.local/synthesis/${difficulty}-${offset}.private.json`, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify({ ...report, qualified: report.qualified.map(({ seed, pattern, core }) => ({ seed, pattern, core })) }, null, 2));
