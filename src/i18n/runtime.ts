import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from "./locales";
import { translate, type TranslationKey, type TranslationParams } from "./translate";

const STORAGE_KEY = "gitgud:locale:v1";

let current: Locale = DEFAULT_LOCALE;

/** The active locale for code outside React, such as services and share text. */
export function currentLocale(): Locale {
  return current;
}

/** Translates with the active locale. React components should prefer `useI18n().t`. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(current, key, params);
}

/** Saved choice first, then the browser's preferred languages, then English. */
export function initialLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can be blocked; fall through to the browser languages.
  }
  if (typeof navigator !== "undefined") {
    return matchLocale(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
  }
  return DEFAULT_LOCALE;
}

/** Makes `locale` active for the whole app and the document, and remembers it when asked. */
export function applyLocale(locale: Locale, persist: boolean) {
  current = locale;
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  if (!persist) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // The choice still applies for this visit.
  }
}
