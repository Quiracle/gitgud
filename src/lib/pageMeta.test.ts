import { describe, expect, it } from "vitest";
import { LOCALES } from "../i18n/locales";
import { learnBasicsCatalog } from "../puzzles/learnBasics/catalog";
import { indexablePaths, pageMeta, SITE_ORIGIN } from "./pageMeta";
import { renderStaticPage, sitemapXml } from "./staticPages";

const SHELL = `<html><head>
    <!-- page:head -->
    <title>old</title>
    <!-- /page:head -->
  </head><body><div id="root"></div>
    <!-- page:body -->
    <!-- /page:body -->
  </body></html>`;

describe("page meta", () => {
  it("lists the public screens and every lesson for search engines", () => {
    const paths = indexablePaths();
    expect(paths.slice(0, 3)).toEqual(["/", "/play", "/course"]);
    for (const lesson of learnBasicsCatalog) expect(paths).toContain(`/course/${lesson.id}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every public page a distinct title and description in every language", () => {
    for (const locale of LOCALES) {
      const metas = indexablePaths().map((path) => pageMeta(path, locale));
      expect(metas.every((meta) => meta.indexable && meta.canonical?.startsWith(SITE_ORIGIN))).toBe(true);
      expect(new Set(metas.map((meta) => meta.title)).size).toBe(metas.length);
      expect(new Set(metas.map((meta) => meta.description)).size).toBe(metas.length);
    }
  });

  it("keeps private, callback, and unknown screens out of the index", () => {
    for (const path of ["/account", "/account/stats", "/auth/callback", "/linkedin/callback", "/course/practice/abc", "/course/nope", "/nope"]) {
      const meta = pageMeta(path, "en");
      expect(meta.indexable, path).toBe(false);
      expect(meta.canonical, path).toBeUndefined();
    }
  });

  it("names lessons in the player's language and keeps Git commands literal", () => {
    const lesson = learnBasicsCatalog[5];
    const meta = pageMeta(`/course/${lesson.id}`, "es");
    expect(meta.title).toContain("Lección de Git 6");
    expect(meta.description).toContain(lesson.featuredCommands[0]);
  });
});

describe("static pages", () => {
  it("writes the route's head tags and a no-JavaScript summary into the shell", () => {
    const html = renderStaticPage(SHELL, "/course");
    expect(html).toContain(`<link rel="canonical" href="${SITE_ORIGIN}/course" />`);
    expect(html).toContain("<title>Learn Git basics in 10 interactive lessons — GitGud</title>");
    expect(html).not.toContain("<title>old</title>");
    expect(html).toMatch(/<noscript><h1>Learn Git basics in 10 interactive lessons<\/h1>/);
    expect(html).toContain(`href="/course/${learnBasicsCatalog[0].id}"`);
  });

  it("marks the 404 page noindex without a canonical URL", () => {
    const html = renderStaticPage(SHELL, "/404");
    expect(html).toContain(`<meta name="robots" content="noindex" />`);
    expect(html).not.toContain(`rel="canonical"`);
  });

  it("puts valid structured data only on the home page", () => {
    const home = renderStaticPage(SHELL, "/");
    const json = home.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(JSON.parse(json ?? "")["@graph"].map((node: { "@type": string }) => node["@type"])).toEqual(["WebSite", "WebApplication"]);
    expect(renderStaticPage(SHELL, "/play")).not.toContain("application/ld+json");
  });

  it("lists every public page in the sitemap", () => {
    const xml = sitemapXml();
    for (const path of indexablePaths()) expect(xml).toContain(`<loc>${SITE_ORIGIN}${path}</loc>`);
  });
});
