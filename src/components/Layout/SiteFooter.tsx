import { useI18n } from "../../i18n/I18nProvider";
import { AppLink } from "../AppLink";
import { LanguagePicker } from "../LanguagePicker/LanguagePicker";

/** Figma footer (node 24:44218), plus the language picker so guests can switch too. */
export function SiteFooter({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-grey-500 px-6 pb-[var(--nav-clearance)] pt-4">
      <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-paragraph text-grey-950">Gitgudgame.lol</p>
        <div className="flex items-center gap-4">
          <LanguagePicker />
          <AppLink
            href="/legal"
            onNavigate={onNavigate}
            className="flex min-h-11 items-center text-xs text-grey-600 underline decoration-from-font underline-offset-2 transition-colors hover:text-grey-950"
          >
            {t("footer.privacy")}
          </AppLink>
        </div>
      </div>
    </footer>
  );
}

/** Grey card from Figma; hover darkens the fill only, so the card never changes size. */
export const CARD_SURFACE =
  "rounded border border-grey-300 bg-grey-300 transition-colors duration-200 hover:border-card-hover hover:bg-card-hover";
