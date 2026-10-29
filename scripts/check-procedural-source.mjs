import { readFile, writeFile } from "node:fs/promises";
import { dailyCertificateSource } from "./daily-certificate-source.mjs";

const path = "src/puzzles/generation/proceduralManifest.json";
const expected = { formatVersion: 1, evaluatorVersion: 1, sourceFingerprint: await dailyCertificateSource() };
if (process.argv.includes("--write")) {
  await writeFile(path, JSON.stringify(expected, null, 2) + "\n");
  console.log("Wrote the procedural evaluator fingerprint. Old artifacts require recertification when this changes.");
} else {
  const actual = JSON.parse(await readFile(path, "utf8"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Procedural evaluator fingerprint is stale. Update it and recertify the private candidate inventory before deployment.");
  console.log("Procedural evaluator fingerprint matches the checked-in source.");
}
