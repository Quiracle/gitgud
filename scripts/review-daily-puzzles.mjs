import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Local review material only: no AI, credentials, database, or publication.
const output = resolve("daily-review.local");
const compiled = await build({ stdin: {
  contents: "export * from './src/puzzles/generation/certified'; export {validatePuzzleCandidate} from './src/puzzles/validateCandidate'; export {getSnapshot} from './src/engine'; export {CHICKEN_V2_SEMANTIC_POLICY} from './src/puzzles/chickenTheme';",
  resolveDir: process.cwd(), loader: "ts",
}, bundle: true, write: false, format: "esm", platform: "node" });
const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
await mkdir(output, { recursive: true });
const sections = ["# Daily puzzle review pack", "Generated locally from the certified library. These are review examples, not published daily puzzles. Every supported command remains available. Win by matching the target on main, with main checked out.",
  "Review whether the puzzle has a useful discovery, whether alternatives are interesting, and whether the hints are helpful. The minimum command count proves resistance to shortcuts; it does not measure enjoyment."];
const proofs = {};
const existingDates = new Map();
for (const template of domain.DAILY_CERTIFICATION.templates) {
  try {
    const existing = JSON.parse(await readFile(resolve(output, `${template.templateId}.json`), "utf8"));
    if (/^2099-\d{2}-\d{2}$/.test(existing.publishedOn)) existingDates.set(template.templateId, existing.publishedOn);
  } catch { /* First review example for this template. */ }
}
const usedDates = new Set(existingDates.values());
for (const [index, template] of domain.DAILY_CERTIFICATION.templates.entries()) {
  // Curation can retire templates without changing examples a person is already testing.
  let date = existingDates.get(template.templateId);
  if (!date) {
    let offset = index;
    do { date = new Date(Date.UTC(2099, 0, 1 + offset++)).toISOString().slice(0, 10); } while (usedDates.has(date));
  }
  usedDates.add(date);
  const generated = domain.createCertifiedDaily(date, template.difficulty, "review-pack-v1", template.templateId);
  const validated = domain.validatePuzzleCandidate(generated.candidate, { semantic: domain.CHICKEN_V2_SEMANTIC_POLICY });
  if (!validated.ok) throw new Error(`Review candidate invalid: ${template.templateId}`);
  const puzzle = validated.value.puzzle;
  await writeFile(resolve(output, `${template.templateId}.json`), JSON.stringify(puzzle, null, 2) + "\n");
  proofs[template.templateId] = validated.value.privateMetadata.solutionCommands;
  const initial = domain.getSnapshot(puzzle.initialRepository);
  const appearance = value => Object.entries(value).filter(([, v]) => v !== "none").map(([k, v]) => `${k}=${v}`).join(", ");
  const head = id => Object.entries(puzzle.initialRepository.branches).filter(([, value]) => value === id).map(([name]) => name).join(", ");
  sections.push(`## ${template.templateId}: ${template.family}`, `Verified shortest solution: **${generated.quality.minimumCommands} commands**. Initial branch: main.`,
    `Initial appearance: ${appearance(initial)}.\n\nTarget appearance: ${appearance(puzzle.target.snapshot)}.`,
    "| Commit | Parents | Branch heads | Change |\n| --- | --- | --- | --- |\n" + Object.values(puzzle.initialRepository.commits).map(c =>
      `| ${c.id} | ${c.parents.join(", ") || "root"} | ${head(c.id)} | ${c.changes.map(change => `${change.property}: ${change.from} → ${change.to}`).join("; ") || "Initial repository"} |`).join("\n"),
    "Hints:\n\n" + puzzle.hints.map((hint, i) => `${i + 1}. ${hint}`).join("\n"),
    `<details>\n<summary>One valid solution (spoiler)</summary>\n\n\`\`\`text\n${proofs[template.templateId].join("\n")}\n\`\`\`\n\n</details>`);
}
await writeFile(resolve(output, "private-proofs.json"), JSON.stringify(proofs, null, 2) + "\n");
await writeFile(resolve(output, "review.md"), sections.join("\n\n") + "\n");
console.log(`Wrote ${domain.DAILY_CERTIFICATION.templates.length} validated review puzzles to ${output}`);
console.log(`Start with ${resolve(output, "review.md")}. Proofs are separate from public JSON definitions.`);
