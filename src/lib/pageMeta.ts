import type { Locale } from "../i18n/locales";
import { translate } from "../i18n/translate";
import { learnBasicsCatalog } from "../puzzles/learnBasics/catalog";
import { localizeLesson } from "../puzzles/learnBasics/translations";
import type { LearnBasicsLesson } from "../puzzles/learnBasics/types";

/** The production origin search engines should treat as canonical. The apex domain redirects here. */
export const SITE_ORIGIN = "https://www.gitgudgame.lol";

export interface PageMeta {
  /** Visible page heading, used for the no-JavaScript fallback. */
  heading: string;
  title: string;
  description: string;
  /** False for private, callback, and unknown screens: they must stay out of search results. */
  indexable: boolean;
  /** Absolute canonical URL, only for indexable pages. */
  canonical?: string;
  lesson?: LearnBasicsLesson;
}

const PRIVATE_PREFIXES = ["/account", "/auth/", "/linkedin/", "/course/practice/"];

/** Every public page, in sitemap order. */
export function indexablePaths(): string[] {
  return [
    "/",
    "/play",
    "/course",
    ...learnBasicsCatalog.filter((lesson) => lesson.status === "available").map((lesson) => `/course/${lesson.id}`),
    "/leaderboard",
    "/legal",
  ];
}

/** Title, description, and indexing rules for a route, in `locale`. */
export function pageMeta(path: string, locale: Locale): PageMeta {
  const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate(locale, key, params);
  const page = (heading: string, description: string): PageMeta => ({
    heading,
    title: t("meta.page.title", { title: heading }),
    description,
    indexable: true,
    canonical: SITE_ORIGIN + path,
  });

  if (path === "/") {
    return { heading: t("meta.title"), title: t("meta.title"), description: t("meta.description"), indexable: true, canonical: `${SITE_ORIGIN}/` };
  }
  if (path === "/play") return page(t("meta.play.heading"), t("meta.play.description"));
  if (path === "/course") return page(t("meta.course.heading"), t("meta.course.description"));
  if (path === "/leaderboard") return page(t("meta.leaderboard.heading"), t("meta.leaderboard.description"));
  if (path === "/legal") return page(t("meta.legal.heading"), t("meta.legal.description"));

  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    return { heading: t("meta.title"), title: t("meta.title"), description: t("meta.description"), indexable: false };
  }

  if (path.startsWith("/course/")) {
    const id = decodeURIComponent(path.slice("/course/".length));
    const found = learnBasicsCatalog.find((candidate) => candidate.id === id && candidate.status === "available");
    if (found) {
      const lesson = localizeLesson(found, locale);
      return {
        heading: lesson.title,
        title: t("meta.lesson.title", { title: lesson.title, number: lesson.order }),
        description: t("meta.lesson.description", { summary: lesson.summary, commands: lesson.featuredCommands.join(", ") }),
        indexable: true,
        canonical: SITE_ORIGIN + path,
        lesson,
      };
    }
  }

  const heading = t("notFound.title");
  return { heading, title: t("meta.page.title", { title: heading }), description: t("meta.description"), indexable: false };
}

/** Points the document head at the current route: title, description, canonical, and robots. */
export function applyPageMeta(path: string, locale: Locale) {
  if (typeof document === "undefined") return;
  const meta = pageMeta(path, locale);
  document.title = meta.title;
  setHeadTag("meta", "name", "description", "content", meta.description);
  setHeadTag("meta", "name", "robots", "content", meta.indexable ? null : "noindex");
  setHeadTag("link", "rel", "canonical", "href", meta.canonical ?? null);
  setHeadTag("meta", "property", "og:title", "content", meta.title);
  setHeadTag("meta", "property", "og:description", "content", meta.description);
  setHeadTag("meta", "property", "og:url", "content", meta.canonical ?? null);
}

/** Creates, updates, or (with a null value) removes one identifying head tag. */
function setHeadTag(tag: "meta" | "link", keyAttribute: string, key: string, valueAttribute: string, value: string | null) {
  let element = document.head.querySelector<HTMLElement>(`${tag}[${keyAttribute}="${key}"]`);
  if (value === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement(tag);
    element.setAttribute(keyAttribute, key);
    document.head.append(element);
  }
  element.setAttribute(valueAttribute, value);
}
