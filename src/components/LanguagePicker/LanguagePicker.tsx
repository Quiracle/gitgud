import { useId } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, isLocale } from "../../i18n/locales";
import { Icon } from "../Icon/Icon";

interface LanguagePickerProps {
  /** "light" sits on the pale page background; "dark" on green panels. */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Globe, short tag (ES, CAT, ENG) and chevron, with an invisible native select laid over
 * them so keyboards, screen readers and phone pickers still work. The open list names each
 * language in full, in its own language, tagged with it for correct pronunciation.
 */
export function LanguagePicker({ tone = "light", className = "" }: LanguagePickerProps) {
  const { locale, setLocale, t } = useI18n();
  const id = useId();
  const colors = tone === "dark" ? "text-grey-50 hover:text-lime-300" : "text-grey-950 hover:text-grey-700";

  return (
    <div
      className={`relative flex min-h-11 items-center gap-1.5 rounded transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime-400 ${colors} ${className}`}
    >
      <label htmlFor={id} className="sr-only">
        {t("common.language")}
      </label>
      <Icon name="language" size={16} className={tone === "dark" ? "text-lime-400" : undefined} />
      <span aria-hidden className="text-xs">
        {LOCALE_TAGS[locale]}
      </span>
      <Icon name="keyboard_arrow_down" size={16} />
      <select
        id={id}
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
        className="absolute inset-0 w-full cursor-pointer appearance-none text-base text-grey-950 opacity-0"
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
