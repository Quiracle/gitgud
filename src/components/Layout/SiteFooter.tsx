import { useI18n } from "../../i18n/I18nProvider";
import { LanguagePicker } from "../LanguagePicker/LanguagePicker";

/** Figma footer (node 24:44218), plus the language picker so guests can switch too. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-grey-500 px-6 pb-[var(--nav-clearance)] pt-4">
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-paragraph text-grey-950">Gitgudgame.lol</p>
        <div className="flex items-center gap-4">
          <LanguagePicker />
          <p className="text-xs text-grey-600">{t("footer.privacy")}</p>
        </div>
      </div>
    </footer>
  );
}

/** Grey card from Figma; hover darkens the fill only, so the card never changes size. */
export const CARD_SURFACE =
  "rounded border border-grey-300 bg-grey-300 transition-colors duration-200 hover:border-card-hover hover:bg-card-hover";
