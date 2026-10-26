import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { build } from "esbuild";
import { resolve } from "node:path";

interface StaticPagesModule {
  indexablePaths(): string[];
  renderStaticPage(html: string, path: string): string;
  sitemapXml(): string;
}

/** Bundles src/lib/staticPages.ts on the fly, since this config's TypeScript project cannot import app source. */
async function loadStaticPages(): Promise<StaticPagesModule> {
  const result = await build({
    entryPoints: [resolve("src/lib/staticPages.ts")],
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    write: false,
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

/**
 * Gives every public route its own HTML file with that page's title, description, canonical
 * URL, and a no-JavaScript summary, plus a 404 page and the sitemap. The app is unchanged:
 * each file loads the same bundle, which reads the URL as before.
 */
function staticPages(): Plugin {
  return {
    name: "gitgud-static-pages",
    apply: "build",
    // After Vite's own HTML plugin, which emits index.html in this same hook.
    enforce: "post",
    async generateBundle(_, bundle) {
      const shell = bundle["index.html"];
      if (!shell || shell.type !== "asset") throw new Error("The build has no index.html to copy.");
      const pages = await loadStaticPages();
      const html = String(shell.source);
      shell.source = pages.renderStaticPage(html, "/");
      for (const path of pages.indexablePaths()) {
        if (path === "/") continue;
        this.emitFile({ type: "asset", fileName: `${path.slice(1)}/index.html`, source: pages.renderStaticPage(html, path) });
      }
      this.emitFile({ type: "asset", fileName: "404.html", source: pages.renderStaticPage(html, "/404") });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: pages.sitemapXml() });
    },
  };
}

export default defineConfig({
  plugins: [react(), staticPages()],
});
