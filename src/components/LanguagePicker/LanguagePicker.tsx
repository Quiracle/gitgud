import { useId } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { LOCALES, LOCALE_NAMES, isLocale } from "../../i18n/locales";
import { Icon } from "../Icon/Icon";

interface LanguagePickerProps {
  /** "light" sits on the pale page background; "dark" on green panels. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Native select so it works with keyboards, screen readers, and phone pickers. Each
 * option is written in its own language and tagged with it for correct pronunciation.
 */
export function LanguagePicker({ tone = "light", className = "" }: LanguagePickerProps) {
  const { locale, setLocale, t } = useI18n();
  const id = useId();
  const colors = tone === "dark" ? "text-grey-50 border-grey-600 bg-green-900" : "text-grey-950 border-grey-500 bg-transparent";

  return (
    <div className={`relative flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t("common.language")}
      </label>
      <Icon name="language" size={16} className={`pointer-events-none absolute left-2 ${tone === "dark" ? "text-lime-400" : "text-grey-700"}`} />
      <select
        id={id}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className={`min-h-11 appearance-none rounded border py-2 pl-8 pr-3 text-base sm:text-xs ${colors}`}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option} lang={option}>
            {LOCALE_NAMES[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
