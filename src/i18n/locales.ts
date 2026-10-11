export const LOCALES = ["en", "es", "ca"] as const;
export type Locale = typeof LOCALES[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Each language in its own name, as language pickers should show them. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ca: "Català",
};

/** Short tags for compact pickers: the button shows these, the open list shows the full names. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "ENG",
  es: "ES",
  ca: "CAT",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks the first supported language from a browser preference list, matching on the
 * primary subtag: "ca-ES-valencia" → ca, "es-MX" → es, "en-GB" → en.
 */
export function matchLocale(preferences: readonly string[]): Locale {
  for (const tag of preferences) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
