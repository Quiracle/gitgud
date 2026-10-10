import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "./locales";
import { applyLocale, initialLocale } from "./runtime";
import { translate, type TranslationKey, type TranslationParams } from "./translate";

export interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatList: (items: readonly string[], type?: Intl.ListFormatType) => string;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const first = initialLocale();
    applyLocale(first, false);
    return first;
  });

  const setLocale = useCallback((next: Locale) => {
    applyLocale(next, true);
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const numbers = new Intl.NumberFormat(locale);
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      formatNumber: (input, options) => (options ? new Intl.NumberFormat(locale, options) : numbers).format(input),
      formatDate: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
      formatList: (items, type = "conjunction") => new Intl.ListFormat(locale, { style: "long", type }).format(items),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}
