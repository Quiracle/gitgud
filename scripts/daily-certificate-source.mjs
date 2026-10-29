import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";

/** Individual certificates depend on the evaluator, not the proposal generator. */
export async function dailyCertificateSource() {
  async function engineFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map(entry => entry.isDirectory() ? engineFiles(resolve(directory, entry.name))
      : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [resolve(directory, entry.name)] : []))).flat();
  }
  const paths = [...await engineFiles(resolve("src/engine")),
    ...["completion", "rules", "par", "types", "validateCandidate", "schema", "policy", "chickenTheme",
      "generation/quality", "generation/proceduralCertification", "generation/candidateArtifact", "generation/novelty",
      "generation/decisionCore", "generation/proceduralQuality", "generation/mechanicsState", "generation/terminalCommands"].map(name => resolve(`src/puzzles/${name}.ts`))].sort();
  const hash = createHash("sha256");
  for (const path of paths) hash.update(relative(process.cwd(), path).replaceAll("\\", "/") + "\n" + (await readFile(path, "utf8")).replaceAll("\r\n", "\n"));
  return hash.digest("hex");
}
