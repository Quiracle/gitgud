import { build } from "esbuild";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";

// Public review definitions only. Private artifacts/proofs stay in the reserve.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
const sourceFingerprint = await dailyCertificateSource();
const manifest = JSON.parse(await readFile("src/puzzles/generation/proceduralManifest.json", "utf8"));
if (sourceFingerprint !== manifest.sourceFingerprint) throw new Error("Evaluator source is stale.");
const compiled = await build({ stdin: { contents: "export * from './src/puzzles/generation/candidateArtifact'; export {validatePuzzleCandidate} from './src/puzzles/validateCandidate'; export {CHICKEN_V2_SEMANTIC_POLICY} from './src/puzzles/chickenTheme';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const directory = "daily-review.local/candidate-reserve";
const entries = [], usedDates = new Set();
for (const file of (await readdir(directory)).sort()) {
  if (!/^[a-f0-9]{64}\.private\.json$/.test(file)) continue;
  const raw = JSON.parse(await readFile(`${directory}/${file}`, "utf8"));
  if (raw.certificate?.sourceFingerprint !== sourceFingerprint) continue;
  const artifact = await domain.verifyCandidateArtifact(raw, { sourceFingerprint });
  const name = `${artifact.candidate.difficulty}-${parseInt(artifact.id.slice(0, 13), 16)}`;
  let offset = parseInt(artifact.id.slice(0, 6), 16) % 36000;
  while (usedDates.has(offset)) offset++;
  usedDates.add(offset);
  const date = new Date(Date.UTC(2099, 0, 1 + offset)).toISOString().slice(0, 10);
  const candidate = { ...artifact.candidate, id: `review-${name}`, slug: `review-${name}`, publishedOn: date };
  const validated = domain.validatePuzzleCandidate(candidate, { semantic: domain.CHICKEN_V2_SEMANTIC_POLICY });
  if (!validated.ok) throw new Error(`Invalid review artifact ${artifact.id}`);
  await writeFile(`daily-review.local/${name}.json`, JSON.stringify(validated.value.puzzle, null, 2) + "\n");
  entries.push({ name, difficulty: candidate.difficulty, commits: Object.keys(candidate.initialRepository.commits).length,
    branches: Object.keys(candidate.initialRepository.branches).length, candidateId: artifact.id });
}
const text = ["# Procedural playtest pack", "Locally certified examples, not published dailies. These files contain no solution commands. Start Vite in review mode; each link selects its own puzzle and saved progress.",
  "Assess the discovery, clarity, alternative approaches, and whether the next puzzle feels meaningfully different. Certification does not prove enjoyment.",
  ...entries.sort((a,b) => a.difficulty.localeCompare(b.difficulty) || a.name.localeCompare(b.name)).map(entry => `- [${entry.name}](http://127.0.0.1:5177/play?review=${entry.name}): ${entry.commits} commits, ${entry.branches} branches.`)];
await writeFile("daily-review.local/procedural-review.md", text.join("\n\n") + "\n");
await writeFile("daily-review.local/procedural-review-index.json", JSON.stringify(entries, null, 2) + "\n");
console.log(`Wrote ${entries.length} spoiler-free procedural review definitions and procedural-review.md.`);
