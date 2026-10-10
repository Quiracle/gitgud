import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { decideCookies, useCookieConsent } from "../../hooks/useCookieConsent";
import { useI18n } from "../../i18n/I18nProvider";
import { Rich } from "../../i18n/Rich";
import { spring } from "../../lib/motion";
import { AppLink } from "../AppLink";
import { Button } from "../Button/Button";

interface CookieBannerProps {
  /** Screens without room (the puzzle terminal) wait to ask; analytics stays off meanwhile. */
  visible: boolean;
  /** Sits above the floating bottom nav when that's showing. */
  aboveNav: boolean;
  onNavigate: (path: string) => void;
}

/**
 * Asks before Google Analytics loads. Reject and Accept share one style and size, as the
 * AEPD requires, and Cookie settings in the footer brings the banner back.
 */
export function CookieBanner({ visible, aboveNav, onNavigate }: CookieBannerProps) {
  const { t } = useI18n();
  const { analytics, bannerOpen } = useCookieConsent();

  const PolicyLink = ({ children }: { children: ReactNode }) => (
    <AppLink
      href="/legal#cookies"
      onNavigate={onNavigate}
      className="text-grey-50 underline decoration-from-font underline-offset-2 transition-colors hover:text-lime-300"
    >
      {children}
    </AppLink>
  );

  return (
    <AnimatePresence>
      {visible && bannerOpen && (
        <motion.section
          role="region"
          aria-labelledby="cookie-banner-title"
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0, transition: { duration: 0.15 } }}
          transition={{ ...spring.soft, delay: 0.4 }}
          className={`fixed inset-x-4 z-40 mx-auto flex max-w-[480px] flex-col gap-3 rounded border border-grey-700 bg-green-950 p-4 shadow-[0_12px_32px_-12px_rgb(var(--colors-green-950)/0.6)] ${
            aboveNav ? "bottom-[calc(16px+65px+8px+env(safe-area-inset-bottom))]" : "bottom-[calc(16px+env(safe-area-inset-bottom))]"
          }`}
        >
          <h2 id="cookie-banner-title" className="text-xl leading-[25px] text-grey-50">
            {t("consent.title")}
          </h2>
          <p className="text-sm text-grey-300">
            <Rich text={t("consent.body")} tags={{ policy: PolicyLink }} />
          </p>
          {analytics !== undefined && (
            <p className="text-xs leading-[15px] text-grey-300">
              {t(analytics ? "consent.currentAccepted" : "consent.currentRejected")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => decideCookies(false)}>
              {t("consent.reject")}
            </Button>
            <Button variant="outline" onClick={() => decideCookies(true)}>
              {t("consent.accept")}
            </Button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
