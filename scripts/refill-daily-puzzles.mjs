import { build } from "esbuild";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID, webcrypto } from "node:crypto";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";
import { readPrivateJson, writePrivateJson } from "./private-artifacts.mjs";

// Private offline worker. --upload is explicit; default operation has no network.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
process.on("uncaughtException", error => { console.error(error.message); process.exit(1); });
const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (key === "--upload" || key === "--recertify-local") options.set(key, true);
  else if (["--difficulty", "--target", "--max-seeds", "--minutes", "--start", "--seed-prefix", "--search-seconds", "--history-file"].includes(key) && args[i + 1] !== undefined) options.set(key, args[++i]);
  else throw new Error("Unknown or incomplete refill argument.");
}
const difficulty = options.get("--difficulty") ?? "medium";
if (!["easy", "medium", "hard"].includes(difficulty)) throw new Error("Unsupported difficulty.");
function integer(name, fallback, minimum, maximum) {
  const value = Number(options.get(name) ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${name}.`);
  return value;
}
const target = integer("--target", 14, 1, 1000);
const maxSeeds = integer("--max-seeds", 300, 1, 10000);
const minutes = integer("--minutes", 30, 1, 180);
const start = integer("--start", 0, 0, 1_000_000);
const searchSeconds = integer("--search-seconds", difficulty === "hard" ? 180 : 30, 1, 600);
const seedPrefix = options.get("--seed-prefix") ?? randomUUID();
const upload = options.has("--upload");
const directory = process.env.DAILY_REFILL_OUTPUT_DIRECTORY ?? "daily-review.local/candidate-reserve";
const sourceFingerprint = await dailyCertificateSource();
const manifest = JSON.parse(await readFile("src/puzzles/generation/proceduralManifest.json", "utf8"));
if (manifest.sourceFingerprint !== sourceFingerprint) throw new Error("Evaluator manifest is stale; do not refill with mismatched certification code.");
const compiled = await build({ stdin: {
  contents: "export * from './src/puzzles/generation/synthesis'; export * from './src/puzzles/generation/procedural'; export * from './src/puzzles/generation/proceduralCertification'; export * from './src/puzzles/generation/proceduralQuality'; export * from './src/puzzles/generation/novelty'; export * from './src/puzzles/generation/decisionCore'; export * from './src/puzzles/generation/candidateArtifact'; export * from './src/puzzles/generation/publishedNovelty'; export {validatePuzzleCandidate} from './src/puzzles/validateCandidate'; export {CHICKEN_V2_SEMANTIC_POLICY} from './src/puzzles/chickenTheme';",
  resolveDir: process.cwd(), loader: "ts",
}, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
if (await dailyCertificateSource() !== sourceFingerprint) throw new Error("Evaluator source changed during worker initialization.");
const endpoint = process.env.DAILY_GENERATION_URL;
const secret = process.env.DAILY_GENERATION_SECRET;
if (upload && (!endpoint || !secret || new URL(endpoint).protocol !== "https:")) throw new Error("Upload needs an HTTPS DAILY_GENERATION_URL and DAILY_GENERATION_SECRET.");
async function api(body) {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json", "x-generation-secret": secret },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Private candidate service returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.certification !== sourceFingerprint) throw new Error("Worker and deployed evaluator versions differ.");
  return data;
}
const knownMechanics = new Set(), knownCores = new Set();
const historicalMechanics = new Set(), historicalCores = new Set();
const staleCandidates = [], remoteStaleIds = new Set(), alreadyRenewed = new Set();
const digest = value => createHash("sha256").update(value).digest("hex");
let publishedHistoryCount = 0;
function rememberHistory(entries) {
  for (const entry of entries) {
    const novelty = domain.publishedPuzzleNovelty(entry.definition, entry.solution_commands);
    knownMechanics.add(digest(novelty.mechanics));
    knownCores.add(digest(novelty.decisionCore));
    historicalMechanics.add(digest(novelty.mechanics));
    historicalCores.add(digest(novelty.decisionCore));
    publishedHistoryCount++;
  }
}
if (options.has("--history-file")) rememberHistory(JSON.parse(await readFile(options.get("--history-file"), "utf8")));
let available = 0;
let strategyCounts = {};
const strategyKey = candidate => domain.solutionCommandPattern(candidate).split(" → ").sort().join("|");
const diversityReady = () => difficulty === "easy" || (Object.keys(strategyCounts).length >= Math.min(4, target) &&
  Math.max(0, ...Object.values(strategyCounts)) <= available * (target < 4 ? 1 / target : 0.35));
async function refreshReserve() {
  const inventory = await api({ mode: "preflight" });
  available = inventory.reserveCounts[difficulty];
  strategyCounts = inventory.strategyCounts[difficulty];
}
if (upload) {
  let historyAfter;
  do {
    const page = await api({ mode: "published-history", ...(historyAfter ? { after: historyAfter } : {}) });
    rememberHistory(page.entries);
    historyAfter = page.next;
  } while (historyAfter);
  let after;
  do {
    const page = await api({ mode: "inventory", ...(after ? { after } : {}) });
    for (const item of page.entries) { knownMechanics.add(item.mechanics_hash); knownCores.add(item.decision_core_hash); }
    after = page.next;
  } while (after);
  let staleAfter;
  do {
    const page = await api({ mode: "stale-candidates", difficulty, ...(staleAfter ? { after: staleAfter } : {}) });
    for (const item of page.entries) {
      staleCandidates.push({ candidate: item.artifact.candidate, existingId: item.id, reservedDate: item.reserved_date });
      remoteStaleIds.add(item.id);
    }
    staleAfter = page.next;
  } while (staleAfter);
  await refreshReserve();
}
await mkdir(directory, { recursive: true });
for (const filename of (await readdir(directory)).sort()) {
  if (!/^[a-f0-9]{64}\.private\.json$/.test(filename)) continue;
  const raw = await readPrivateJson(directory, filename);
  if (!raw) continue;
  // Older evaluator results remain private records, never silently promoted.
  if (raw.certificate?.sourceFingerprint !== sourceFingerprint) {
    if (options.has("--recertify-local") && raw.candidate?.difficulty === difficulty && !remoteStaleIds.has(raw.id)) staleCandidates.push({ candidate: raw.candidate });
    continue;
  }
  const artifact = await domain.verifyCandidateArtifact(raw, { sourceFingerprint });
  if (filename !== `${artifact.id}.private.json`) throw new Error("Private artifact filename does not match its bound identity.");
  if (upload) {
    if (!historicalMechanics.has(artifact.novelty.mechanicsHash) && !historicalCores.has(artifact.novelty.decisionCoreHash) &&
        (remoteStaleIds.has(artifact.id) || (!knownMechanics.has(artifact.novelty.mechanicsHash) && !knownCores.has(artifact.novelty.decisionCoreHash)))) {
      await api({ mode: "register-candidates", artifacts: [artifact] });
      alreadyRenewed.add(artifact.id);
    }
  } else if (artifact.candidate.difficulty === difficulty && !knownMechanics.has(artifact.novelty.mechanicsHash) && !knownCores.has(artifact.novelty.decisionCoreHash)) {
    available++;
    const key = strategyKey(artifact.candidate);
    strategyCounts[key] = (strategyCounts[key] ?? 0) + 1;
  }
  knownMechanics.add(artifact.novelty.mechanicsHash);
  knownCores.add(artifact.novelty.decisionCoreHash);
}
if (upload) await refreshReserve();
for (let index = staleCandidates.length - 1; index >= 0; index--) if (alreadyRenewed.has(staleCandidates[index].existingId)) staleCandidates.splice(index, 1);
staleCandidates.sort((a, b) => Number(Boolean(b.reservedDate)) - Number(Boolean(a.reservedDate)));
const report = { difficulty, sourceFingerprint, publishedHistoryCount, target, initialAvailable: available, attempted: 0, proposed: 0, rejected: 0, unknown: 0, added: 0, recertified: 0, available, patterns: {}, searches: [], recertificationFailures: [] };
const deadline = Date.now() + minutes * 60_000;
const minimum = { easy: 2, medium: 4, hard: 6 }[difficulty];
for (let index = start; index < start + maxSeeds && (available < target || !diversityReady() || staleCandidates.some(item => item.reservedDate)) && Date.now() < deadline; index++) {
  const previous = staleCandidates.shift();
  const recertifyingId = previous?.existingId;
  const seed = previous ? `recertification-${index}` : `${seedPrefix}-${index}`;
  report.attempted++;
  // Broad graphs provide varied medium reasoning; constructive constraints
  // supply harder interactions. Neither path looks up a complete puzzle template.
  if (previous && !domain.validatePuzzleCandidate(previous.candidate, { semantic: domain.CHICKEN_V2_SEMANTIC_POLICY }).ok) {
    report.rejected++;
    report.recertificationFailures.push({ candidateId: recertifyingId, reservedDate: previous.reservedDate, reason: "validation" });
    continue;
  }
  const candidates = previous ? [previous.candidate] : difficulty !== "hard" && index % 2 === 0
    ? domain.proposeProceduralCandidates("2099-01-01", difficulty, seed, 48)
    : [domain.synthesizeDailyCandidate("2099-01-01", difficulty, seed, { maxElapsedMs: 12_000, maxTransitions: 60_000 }).candidate].filter(Boolean);
  report.proposed += candidates.length;
  const fresh = candidates.filter(candidate => {
    if (candidate.solutionCommands.length < minimum || candidate.solutionCommands.length > (difficulty === "hard" ? 10 : minimum)) return false;
    if (!recertifyingId && difficulty !== "easy" && (strategyCounts[strategyKey(candidate)] ?? 0) >= Math.ceil(Math.max(target, available) / Math.min(4, target))) return false;
    if (difficulty !== "easy" && !domain.solutionCommandPattern(candidate).split(" → ").some(command => ["merge", "rebase", "interactive-rebase", "squash"].includes(command))) return false;
    if (difficulty !== "easy" && (domain.proofHasSequentialCopies(candidate) || domain.findCopyOnlySolution(candidate))) return false;
    const mechanics = digest(domain.fingerprintMechanics(candidate.initialRepository, candidate.target).canonical);
    const core = digest(domain.fingerprintDecisionCore(candidate));
    if (historicalMechanics.has(mechanics) || historicalCores.has(core)) return false;
    return Boolean(recertifyingId) || (!knownMechanics.has(mechanics) && !knownCores.has(core));
  });
  if (recertifyingId && !fresh.length) report.recertificationFailures.push({ candidateId: recertifyingId, reservedDate: previous.reservedDate, reason: "quality-policy" });
  report.rejected += candidates.length - fresh.length;
  const searchStarted = Date.now();
  const search = domain.certifyProceduralBatch(fresh, { maxDepth: minimum - 1, maxStates: 150_000, maxTransitions: 3_000_000, maxElapsedMs: searchSeconds * 1000 });
  if (fresh.length) report.searches.push({ seed, candidates: fresh.length, elapsedMs: Date.now() - searchStarted, transitions: search.transitions,
    exploredStates: search.exploredStates, excludedThroughDepth: search.excludedThroughDepth, reason: search.reason ?? "complete" });
  for (const verdict of search.verdicts) {
    if (recertifyingId && verdict.status !== "certified") report.recertificationFailures.push({ candidateId: recertifyingId, reservedDate: previous.reservedDate, reason: verdict.status });
    if (verdict.status === "unknown") { report.unknown++; continue; }
    if (verdict.status !== "certified") { report.rejected++; continue; }
    // Hints and the revealed solution follow the proof, so it must be proven shortest, not merely certified.
    if (!recertifyingId && verdict.candidate.solutionCommands.length > search.excludedThroughDepth + 1) { report.rejected++; continue; }
    if (!recertifyingId && difficulty !== "easy" && (strategyCounts[strategyKey(verdict.candidate)] ?? 0) >= Math.ceil(Math.max(target, available) / Math.min(4, target))) { report.rejected++; continue; }
    const artifact = await domain.createCandidateArtifact(verdict, { sourceFingerprint, excludedThroughDepth: search.excludedThroughDepth });
    if (recertifyingId && artifact.id !== recertifyingId) throw new Error("Recertification changed the reserved candidate identity.");
    if (!recertifyingId && (knownMechanics.has(artifact.novelty.mechanicsHash) || knownCores.has(artifact.novelty.decisionCoreHash))) { report.rejected++; continue; }
    if (await dailyCertificateSource() !== sourceFingerprint) throw new Error("Evaluator source changed while searching. No further artifacts will be saved or uploaded.");
    await writePrivateJson(directory, artifact.id + ".private.json", artifact);
    if (upload) {
      const result = await api({ mode: "register-candidates", artifacts: [artifact] });
      report.added += result.inserted;
      if (recertifyingId) report.recertified += result.inserted;
      await refreshReserve();
    } else {
      report.added++; available++;
      const key = strategyKey(artifact.candidate);
      strategyCounts[key] = (strategyCounts[key] ?? 0) + 1;
    }
    knownMechanics.add(artifact.novelty.mechanicsHash);
    knownCores.add(artifact.novelty.decisionCoreHash);
    const pattern = artifact.novelty.commandPattern;
    report.patterns[pattern] = (report.patterns[pattern] ?? 0) + 1;
    if (available >= target && diversityReady() && !staleCandidates.some(item => item.reservedDate)) break;
  }
  report.available = available;
  console.log(`${difficulty}: attempted ${report.attempted}; available ${available}/${target}; qualified this run ${report.added}; unknown ${report.unknown}`);
  await writePrivateJson(directory, "report-" + difficulty + ".local.json", report);
}
report.strategyCounts = strategyCounts;
report.diversityReady = diversityReady();
// Public CI logs get aggregate health only. Candidate identities, source seeds,
// operation patterns and reserved dates stay in the private local report.
console.log(JSON.stringify({ difficulty, target, available, attempted: report.attempted,
  added: report.added, rejected: report.rejected, unknown: report.unknown,
  recertified: report.recertified, recertificationFailures: report.recertificationFailures.length,
  diversityReady: report.diversityReady }, null, 2));
await writePrivateJson(directory, "report-" + difficulty + ".local.json", report);
if (available < target || !diversityReady() || report.recertificationFailures.some(item => item.reservedDate) || staleCandidates.some(item => item.reservedDate)) {
  console.error("Reserve is below target or a reserved date still needs certification. Retained certified progress; no unproven puzzle was accepted."); process.exitCode = 1;
}
