import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Research only: no database access, no publication, no certificate registry edits.
const [difficulty = "medium", countText = "20", offsetText = "0"] = process.argv.slice(2);
const count = Number(countText), offset = Number(offsetText);
if (!["easy", "medium", "hard"].includes(difficulty) || !Number.isInteger(count) || count < 1 || count > 1000 || !Number.isInteger(offset) || offset < 0) throw new Error("Usage: node scripts/explore-procedural-dailies.mjs easy|medium|hard [1..1000] [offset]");
const compiled = await build({ stdin: {
  contents: "export * from './src/puzzles/generation/procedural'; export * from './src/puzzles/generation/proceduralCertification'; export * from './src/puzzles/generation/proceduralQuality'; export * from './src/puzzles/generation/novelty'; export * from './src/puzzles/generation/decisionCore';",
  resolveDir: process.cwd(), loader: "ts",
}, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const sourceFingerprint = createHash("sha256").update(compiled.outputFiles[0].text).digest("hex");
const summary = { difficulty, count, offset, graphsWithProposals: 0, proposals: 0, shortcuts: 0, unknown: 0, certified: 0, copyOnlyRejected: 0, uniqueMechanics: 0, uniqueDecisionCores: 0, commandPatterns: {}, elapsedMs: 0 };
const accepted = [], fingerprints = new Set(), decisionCores = new Set();
const start = Date.now();
await mkdir("daily-review.local/procedural", { recursive: true });
for (let i = offset; i < offset + count; i++) {
  const seed = `procedural-research-${i}`;
  const candidates = domain.proposeProceduralCandidates("2030-01-01", difficulty, seed, difficulty === "hard" ? 256 : 64);
  if (candidates.length) summary.graphsWithProposals++;
  summary.proposals += candidates.length;
  const result = domain.certifyProceduralBatch(candidates, { maxDepth: { easy: 1, medium: 3, hard: 5 }[difficulty], maxStates: 100_000, maxTransitions: 1_000_000, maxElapsedMs: 30_000 });
  for (const verdict of result.verdicts) {
    if (verdict.status === "shortcut") { summary.shortcuts++; continue; }
    if (verdict.status === "unknown") { summary.unknown++; continue; }
    summary.certified++;
    if (difficulty !== "easy" && domain.findCopyOnlySolution(verdict.candidate)) { summary.copyOnlyRejected++; continue; }
    const fingerprint = domain.fingerprintMechanics(verdict.candidate.initialRepository, verdict.candidate.target).canonical;
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    const decisionCore = domain.fingerprintDecisionCore(verdict.candidate);
    if (decisionCores.has(decisionCore)) continue;
    decisionCores.add(decisionCore);
    const pattern = domain.solutionCommandPattern(verdict.candidate);
    summary.commandPatterns[pattern] = (summary.commandPatterns[pattern] ?? 0) + 1;
    accepted.push({ seed, fingerprint: createHash("sha256").update(fingerprint).digest("hex"), decisionCore: createHash("sha256").update(decisionCore).digest("hex"), candidate: verdict.candidate, search: { excludedThroughDepth: result.excludedThroughDepth, transitions: result.transitions, exploredStates: result.exploredStates } });
  }
  console.log(`${difficulty} ${i}: ${candidates.length} proposed; ${result.verdicts.filter(v => v.status === "certified").length} certified; ${result.transitions} transitions`);
  summary.uniqueMechanics = fingerprints.size;
  summary.uniqueDecisionCores = decisionCores.size;
  summary.elapsedMs = Date.now() - start;
  await writeFile(`daily-review.local/procedural/${difficulty}-${offset}.private.json`, JSON.stringify({ sourceFingerprint, summary, accepted }, null, 2) + "\n");
}
console.log(JSON.stringify(summary, null, 2));
