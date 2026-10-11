import { openCookieSettings, useCookieConsent } from "../../hooks/useCookieConsent";
import { useI18n } from "../../i18n/I18nProvider";
import { Button } from "../Button/Button";

/** Account settings row for analytics cookies; Change reopens the consent banner. */
export function CookieSetting() {
  const { t } = useI18n();
  const { analytics } = useCookieConsent();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-paragraph text-grey-950">{t("account.cookies")}</p>
        <p className="truncate text-xs text-grey-600">
          {t(analytics === undefined ? "account.cookies.unset" : analytics ? "account.cookies.accepted" : "account.cookies.rejected")}
        </p>
      </div>
      <Button variant="outlineLight" fullWidth={false} onClick={openCookieSettings}>
        {t("account.cookies.change")}
      </Button>
    </div>
  );
}
