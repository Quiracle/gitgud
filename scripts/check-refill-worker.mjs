import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { webcrypto } from "node:crypto";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";

// Real CLI and SQL migration, with a private SQL-backed fetch fixture.
// No network, hosted database, AI, or browser is involved.
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });
await mkdir("daily-review.local", { recursive: true });
const directory = await mkdtemp(resolve("daily-review.local/worker-check-"));
const source = await dailyCertificateSource();
const compiled = await build({ stdin: { contents: "export * from './src/puzzles/generation/templates'; export * from './src/puzzles/generation/candidateArtifact'; export * from './src/puzzles/generation/proceduralCertification';", resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, format: "esm", platform: "node" });
const domainFile = resolve(directory, "domain.mjs");
await writeFile(domainFile, compiled.outputFiles[0].text);
const domain = await import(pathToFileURL(domainFile).href);
async function artifact(template, fingerprint) {
  const candidate = domain.createTemplateCandidate(template, "2099-01-01", "worker-recertification").candidate;
  const search = domain.certifyProceduralBatch([candidate], { maxDepth: 1 });
  assert.equal(search.verdicts[0].status, "certified");
  return domain.createCandidateArtifact(search.verdicts[0], { sourceFingerprint: fingerprint, excludedThroughDepth: search.excludedThroughDepth });
}
const old = await artifact("easy-0", "a".repeat(64));
const spare = await artifact("easy-1", source);
const fixtureFile = resolve(directory, "fixtures.private.json");
await writeFile(fixtureFile, JSON.stringify({ old, spare, source }));
for (const mode of ["unused", "reserved", "fresh", "incompatible"]) {
  const output = resolve(directory, mode);
  await mkdir(output);
  if (mode === "fresh") await writeFile(resolve(output, "f".repeat(64) + ".private.json"), "{");
  const child = spawnSync(process.execPath, ["scripts/fixtures/refill-worker-runner.mjs", "--difficulty", "easy", "--target", "1", "--max-seeds", mode === "fresh" ? "20" : "1", "--seed-prefix", "worker-fresh", "--minutes", "1", "--upload"], {
    cwd: process.cwd(), encoding: "utf8", timeout: 60_000,
    env: { ...process.env, DAILY_REFILL_OUTPUT_DIRECTORY: output, DAILY_GENERATION_URL: "https://worker-check.invalid/generate", DAILY_GENERATION_SECRET: "test-only-secret",
      WORKER_CHECK_MODE: mode, WORKER_CHECK_DOMAIN: domainFile, WORKER_CHECK_FIXTURES: fixtureFile },
  });
  assert.equal(child.status, mode === "incompatible" ? 1 : 0, child.stderr || child.stdout);
  const report = JSON.parse(await readFile(resolve(output, "report-easy.local.json"), "utf8"));
  const service = JSON.parse(await readFile(resolve(output, "service-result.private.json"), "utf8"));
  const publicLog = child.stdout + child.stderr;
  for (const privateValue of [old.id, spare.id, "f".repeat(64), "worker-fresh", "2099-02-01", '"patterns"', '"strategyCounts"', '"reservedDate"']) {
    assert(!publicLog.includes(privateValue), "Worker logs must not expose private candidate diagnostics: " + privateValue);
  }
  for (const pattern of Object.keys(report.patterns)) assert(!publicLog.includes(pattern));
  assert.equal(report.available, 1);
  if (mode === "incompatible") {
    assert.equal(report.recertified, 0);
    assert.equal(report.recertificationFailures.length, 1);
    assert.equal(report.recertificationFailures[0].reservedDate, "2099-02-01");
    assert.equal(service.certificates, 1);
    assert.equal(service.retry.candidateId, old.id);
    assert.equal(service.retry.artifact, null);
    continue;
  }
  assert.equal(report.recertificationFailures.length, 0);
  if (mode === "fresh") {
    assert.equal(report.recertified, 0);
    assert.equal(service.certificates, 1);
    assert.notEqual(service.registeredId, old.id);
    const files = await readdir(output);
    assert(files.some(file => file.startsWith("f".repeat(64) + ".private.json.invalid-")));
    assert(!files.some(file => file.includes(".partial-")));
    continue;
  }
  assert.equal(report.recertified, 1);
  assert.equal(service.certificates, 2);
  assert.equal(service.registeredId, old.id);
  if (mode === "reserved") {
    assert.equal(report.initialAvailable, 1); // Repair must run even with a full reserve.
    assert.equal(service.retry.candidateId, old.id);
    assert.equal(service.retry.difficulty, "easy");
    assert.deepEqual(service.retry.artifact.candidate, old.candidate);
  }
}
console.log("Real refill CLI passed SQL-backed checks: fresh upload, recertification, full-reserve date repair, and incompatible-proof rejection without rerolling.");
