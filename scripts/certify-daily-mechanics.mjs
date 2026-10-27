import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

// Offline verification only. No credentials, AI calls, or production writes.
const output = resolve("src/puzzles/generation/certificates.json");
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(entry => entry.isDirectory()
    ? sourceFiles(resolve(directory, entry.name))
    : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [resolve(directory, entry.name)] : []));
  return paths.flat();
}
const paths = [...await sourceFiles(resolve("src/engine")),
  ...["completion.ts", "rules.ts", "generation/quality.ts", "generation/deterministic.ts", "generation/integration.ts"].map(p => resolve("src/puzzles", p))].sort();
const hash = createHash("sha256");
for (const path of paths) hash.update(relative(process.cwd(), path).replaceAll("\\", "/") + "\n" + (await readFile(path, "utf8")).replaceAll("\r\n", "\n"));
const sourceFingerprint = hash.digest("hex");
// The three-module bundled family exceeded the exhaustive search budget. It is
// deliberately excluded, rather than treating an inconclusive search as proof.
// Easy variants 2/3 are isomorphic to 0/1; do not count cosmetic duplicates as variety.
const variants = { easy: [0, 1, 4], medium: [0, 1, 2, 3, 4, 5], hard: [0, 1, 2, 3, 5] };
const templateIds = Object.entries(variants).flatMap(([d, values]) => values.map(v => `${d}-${v}`));
let previous;
try { previous = JSON.parse(await readFile(output, "utf8")); } catch { /* First certification. */ }
if (process.argv.includes("--check")) {
  if (previous?.sourceFingerprint !== sourceFingerprint) throw new Error("Daily certificates are stale. Run pnpm daily:certify before shipping.");
  if (previous.certificates.length !== templateIds.length || templateIds.some(id => !previous.certificates.some(c => c.templateId === id && c.search.status === "exhausted" && c.search.excludedThroughDepth >= c.minimumCommands - 1))) {
    throw new Error("Daily certificate registry is incomplete.");
  }
  console.log(`Daily certificates match the engine and generator (${previous.certificates.length} templates).`);
  process.exit(0);
}
const compiled = await build({ stdin: {
  contents: "export * from './src/puzzles/generation/deterministic'; export * from './src/puzzles/generation/quality'; export * from './src/puzzles/generation/integration';",
  resolveDir: process.cwd(), loader: "ts",
}, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const certificates = [];
for (const difficulty of ["easy", "medium", "hard"]) {
  const minimumCommands = { easy: 2, medium: 4, hard: 6 }[difficulty];
  for (const variant of variants[difficulty]) {
    const templateId = `${difficulty}-${variant}`;
    const generated = variant === 5 ? domain.createIntegrationCandidate("2030-01-01", difficulty, "certification-v1") : variant === 4
      ? domain.createBundledCandidate("2030-01-01", difficulty, "certification-v1")
      : domain.createDeterministicCandidate("2030-01-01", difficulty, "certification-v1", variant);
    const matching = certificates.find(c => c.signature === generated.signature) ??
      (previous?.sourceFingerprint === sourceFingerprint ? previous.certificates.find(c => c.signature === generated.signature) : undefined);
    const started = Date.now();
    const search = matching?.search ?? domain.searchDailyPuzzle(generated.candidate, {
      maxDepth: minimumCommands - 1, maxStates: 150_000, maxTransitions: 3_000_000, maxInteractivePlans: 4096,
    });
    if (search.status !== "exhausted" || search.excludedThroughDepth !== minimumCommands - 1) {
      throw new Error(`${templateId} not certified: ${JSON.stringify(search)}`);
    }
    const certificate = { templateId, difficulty, family: generated.family,
      generatorVersion: domain.DETERMINISTIC_GENERATOR_VERSION, evaluatorVersion: domain.DAILY_EVALUATOR_VERSION,
      minimumCommands, signature: generated.signature, search };
    certificates.push(certificate);
    // Progress is resumable only when its exact source fingerprint still matches.
    await writeFile(output, JSON.stringify({ sourceFingerprint, certificates }, null, 2) + "\n");
    console.log(`${templateId}: excludes all routes below ${minimumCommands} commands; ${search.transitions} transitions; ${Date.now() - started} ms`);
  }
}
