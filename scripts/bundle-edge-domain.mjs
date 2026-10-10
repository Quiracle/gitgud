import { build } from "esbuild";
import { resolve } from "node:path";

await build({
  absWorkingDir: process.cwd(),
  entryPoints: [resolve("src/puzzles/generation/edgeEntry.ts")],
  outfile: resolve("supabase/functions/_shared/domain.bundle.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  sourcemap: false,
  legalComments: "none",
});
