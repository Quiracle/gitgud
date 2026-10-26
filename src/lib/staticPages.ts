import { DEFAULT_LOCALE, LOCALES } from "../i18n/locales";
import { translate } from "../i18n/translate";
import { learnBasicsCatalog } from "../puzzles/learnBasics/catalog";
import { indexablePaths, pageMeta, SITE_ORIGIN } from "./pageMeta";

// The build writes one HTML file per public route from these, so crawlers that do not run
// JavaScript still get each page's title, description, canonical URL, and a text summary.
// The summary sits in <noscript>, so visitors with JavaScript never see it.

export { indexablePaths };

const HEAD_START ="<!-- page:head -->";
const HEAD_END = "<!-- /page:head -->";
const BODY_START = "<!-- page:body -->";
const BODY_END = "<!-- /page:body -->";

const locale = DEFAULT_LOCALE;

/** Fills the marked head and body regions of the built index.html for `path`. */
export function renderStaticPage(html: string, path: string): string {
  return replaceRegion(replaceRegion(html, HEAD_START, HEAD_END, headTags(path)), BODY_START, BODY_END, noscript(path));
}

/** A sitemap of every public route. */
export function sitemapXml(): string {
  const urls = indexablePaths()
    .map((path) => `  <url><loc>${escapeHtml(SITE_ORIGIN + path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function headTags(path: string): string {
  const meta = pageMeta(path, locale);
  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    meta.indexable ? null : `<meta name="robots" content="noindex" />`,
    meta.canonical ? `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />` : null,
    `<meta property="og:site_name" content="GitGud" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    meta.canonical ? `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />` : null,
    `<meta name="twitter:card" content="summary" />`,
    path === "/" ? `<script type="application/ld+json">${jsonLd(homeStructuredData())}</script>` : null,
  ];
  return tags.filter(Boolean).join("\n    ");
}

function noscript(path: string): string {
  const meta = pageMeta(path, locale);
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const links: [string, string][] = [
    ["/", t("nav.home")],
    ["/play", t("meta.play.heading")],
    ["/course", t("meta.course.heading")],
    ["/leaderboard", t("nav.leaderboard")],
  ];
  const lessonLinks =
    path === "/" || path === "/course"
      ? learnBasicsCatalog
          .filter((lesson) => lesson.status === "available")
          .map((lesson) => `<li><a href="/course/${lesson.id}">${escapeHtml(lesson.title)}</a></li>`)
      : [];
  const parts = [
    `<h1>${escapeHtml(meta.heading)}</h1>`,
    `<p>${escapeHtml(meta.description)}</p>`,
    meta.lesson ? `<p>${escapeHtml(meta.lesson.intro.what)}</p>` : null,
    lessonLinks.length ? `<ol>${lessonLinks.join("")}</ol>` : null,
    `<p>${escapeHtml(t("meta.noscript"))}</p>`,
    `<nav><ul>${links.map(([href, label]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul></nav>`,
  ];
  return `<noscript>${parts.filter(Boolean).join("")}</noscript>`;
}

/** Describes only what the home page visibly offers: a free-to-open, in-browser Git puzzle game. */
function homeStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: "GitGud",
        url: `${SITE_ORIGIN}/`,
        inLanguage: [...LOCALES],
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_ORIGIN}/#app`,
        name: "GitGud",
        url: `${SITE_ORIGIN}/`,
        description: translate(locale, "meta.description"),
        applicationCategory: "EducationalApplication",
        applicationSubCategory: "Puzzle game",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript",
        inLanguage: [...LOCALES],
        isAccessibleForFree: true,
        image: `${SITE_ORIGIN}/favicon.png`,
      },
    ],
  };
}

function replaceRegion(html: string, start: string, end: string, content: string): string {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  if (from < 0 || to < from) throw new Error(`index.html is missing the ${start} region.`);
  return html.slice(0, from + start.length) + `\n    ${content}\n    ` + html.slice(to);
}

/** JSON for an inline script: `<` is escaped so the text can never close the script tag. */
function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
