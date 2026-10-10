import type { Locale } from "./locales";
import { ca } from "./messages/ca";
import { en, type MessageKey, type Messages } from "./messages/en";
import { es } from "./messages/es";

export const MESSAGES: Record<Locale, Messages> = { en, es, ca };

/** Plural messages are stored as `key_one` / `key_other` (and optionally `_many`). */
type PluralBase = MessageKey extends infer K
  ? K extends `${infer Base}_other`
    ? Base
    : never
  : never;
type PluralForm = `${string}_${"zero" | "one" | "two" | "few" | "many" | "other"}`;

export type TranslationKey = Exclude<MessageKey, PluralForm> | PluralBase;
export type TranslationParams = Record<string, string | number>;

const pluralRules = new Map<Locale, Intl.PluralRules>();
const numberFormats = new Map<Locale, Intl.NumberFormat>();

/**
 * Looks up a message, chooses its plural form from `params.count` with the locale's
 * CLDR rules, and fills `{name}` placeholders. Numbers are formatted for the locale.
 * Anything missing falls back to English, then to the key itself.
 */
export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const catalog = MESSAGES[locale] as Record<string, string>;
  const english = en as Record<string, string>;
  let template: string | undefined;

  if (params && typeof params.count === "number") {
    const rules = pluralRules.get(locale) ?? new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
    const form = rules.select(params.count);
    template = catalog[`${key}_${form}`] ?? catalog[`${key}_other`] ?? english[`${key}_${form}`] ?? english[`${key}_other`];
  }
  template ??= catalog[key] ?? english[key] ?? key;

  if (!params) return template;
  const numbers = numberFormats.get(locale) ?? new Intl.NumberFormat(locale);
  numberFormats.set(locale, numbers);
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === "number" ? numbers.format(value) : value;
  });
}
