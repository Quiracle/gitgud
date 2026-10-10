import { describe, expect, it } from "vitest";
import type { GoalCheck } from "../engine";
import { learnBasicsCatalog } from "../puzzles";
import { LESSON_TEXT, localizeLesson } from "../puzzles/learnBasics/translations";
import { goalLabel } from "./goals";
import { LOCALES, matchLocale, type Locale } from "./locales";
import { en } from "./messages/en";
import { MESSAGES, translate, type TranslationKey } from "./translate";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
const tags = (text: string) => [...text.matchAll(/<(\w+)>/g)].map((match) => match[1]).sort();

describe("message catalogs", () => {
  it.each(LOCALES.filter((locale) => locale !== "en"))("%s keeps every placeholder and markup tag of English", (locale) => {
    const catalog = MESSAGES[locale] as Record<string, string>;
    for (const [key, english] of Object.entries(en)) {
      const text = catalog[key];
      expect(text?.trim(), key).toBeTruthy();
      expect(placeholders(text), key).toEqual(placeholders(english));
      expect(tags(text), key).toEqual(tags(english));
    }
  });

  it("defines every plural with both one and other forms", () => {
    for (const locale of LOCALES) {
      const keys = Object.keys(MESSAGES[locale]);
      const bases = new Set(keys.filter((key) => /_(one|other)$/.test(key)).map((key) => key.replace(/_(one|other)$/, "")));
      for (const base of bases) {
        expect(keys, `${locale} ${base}`).toContain(`${base}_one`);
        expect(keys, `${locale} ${base}`).toContain(`${base}_other`);
      }
    }
  });
});

describe("locale detection", () => {
  it("matches browser languages on their primary subtag, in preference order", () => {
    expect(matchLocale(["ca-ES-valencia", "es"])).toBe("ca");
    expect(matchLocale(["es-MX"])).toBe("es");
    expect(matchLocale(["fr-FR", "es-ES", "en"])).toBe("es");
    expect(matchLocale(["fr", "de"])).toBe("en");
    expect(matchLocale([])).toBe("en");
  });
});

describe("translate", () => {
  it("chooses plural forms with the locale's rules and formats numbers", () => {
    expect(translate("en", "leaderboard.retries", { count: 1 })).toBe("1 retry");
    expect(translate("en", "leaderboard.retries", { count: 0 })).toBe("0 retries");
    expect(translate("es", "streak.days", { count: 1 })).toBe("¡Racha de 1 día!");
    expect(translate("es", "streak.days", { count: 3 })).toBe("¡Racha de 3 días!");
    expect(translate("ca", "leaderboard.commands", { count: 2 })).toBe("2 ordres");
    // Spanish uses "many" for a million; it falls back to the "other" form.
    expect(translate("es", "leaderboard.retries", { count: 1_000_000 })).toBe("1.000.000 reintentos");
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(translate("ca", "hint.title", { number: 2, total: 3 })).toBe("Pista 2 de 3");
    expect(translate("en", "hint.title", { number: 2 })).toBe("Hint 2 of {total}");
  });

  it("falls back to English, then to the key", () => {
    expect(translate("es", "missing.key" as TranslationKey)).toBe("missing.key");
  });
});

describe("Learn Basics translations", () => {
  const commandTokens = (text: string) =>
    [...text.matchAll(/\b(?:[a-z]\d{2}|--[a-z-]+|git (?:log|switch|merge|cherry-pick|revert|rebase|checkout))\b/g)].map((match) => match[0]).sort();

  it.each(["es", "ca"] as const)("%s matches the English lesson shape and keeps Git identifiers", (locale) => {
    for (const lesson of learnBasicsCatalog) {
      const text = LESSON_TEXT[locale][lesson.id];
      expect(text.intro.how).toHaveLength(lesson.intro.how.length);
      if (lesson.status !== "available") continue;
      expect(text.objectives, lesson.id).toHaveLength(lesson.puzzle.objectives?.length ?? 0);
      expect(text.hints, lesson.id).toHaveLength(lesson.puzzle.hints.length);
      expect(commandTokens(text.hints.join(" ")), lesson.id).toEqual(commandTokens(lesson.puzzle.hints.join(" ")));
      expect(commandTokens(text.intro.task), lesson.id).toEqual(commandTokens(lesson.intro.task));
    }
  });

  it("changes only the words: identity, repository, and target stay the same", () => {
    const lesson = learnBasicsCatalog.find((candidate) => candidate.status === "available")!;
    const localized = localizeLesson(lesson, "ca");
    expect(localized.title).not.toBe(lesson.title);
    if (lesson.status !== "available" || localized.status !== "available") throw new Error("unreachable");
    expect(localized.puzzle.id).toBe(lesson.puzzle.id);
    expect(localized.puzzle.version).toBe(lesson.puzzle.version);
    expect(localized.puzzle.initialRepository).toBe(lesson.puzzle.initialRepository);
    expect(localized.puzzle.target).toBe(lesson.puzzle.target);
    expect(localizeLesson(lesson, "en")).toBe(lesson);
  });
});

describe("goal labels", () => {
  const i18n = (locale: Locale) => ({
    t: (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    formatList: (items: readonly string[]) => new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items),
  });
  const squash: GoalCheck = {
    id: "squash:t61,t63",
    label: "Squash t61 and t63 into one commit",
    met: false,
    goal: { type: "provenance", provenance: "squash", commits: ["t61", "t63"] },
  };

  it("phrases structured goals in each language", () => {
    expect(goalLabel(squash, i18n("en"))).toBe(squash.label);
    expect(goalLabel(squash, i18n("es"))).toBe("Junta t61 y t63 en un solo commit con squash");
    expect(goalLabel(squash, i18n("ca"))).toBe("Ajunta t61 i t63 en un sol commit amb squash");
  });
});
