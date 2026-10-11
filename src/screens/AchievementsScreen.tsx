import { motion } from "motion/react";
import { AchievementList } from "../components/Account/AchievementList";
import { Icon } from "../components/Icon/Icon";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { useI18n } from "../i18n/I18nProvider";
import { featuredAchievements } from "../lib/progressInsights";
import { spring } from "../lib/motion";

interface AchievementsScreenProps {
  onNavigate: (path: string) => void;
}

/** Every achievement: latest unlocks first, then the locked ones still to earn. */
export function AchievementsScreen({ onNavigate }: AchievementsScreenProps) {
  const { t } = useI18n();
  const { achievements } = useProgressInsights();
  const unlocked = achievements.filter((item) => item.unlocked).length;

  function back() {
    if (window.history.length > 1) window.history.back();
    else onNavigate("/account");
  }

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <button
            type="button"
            onClick={back}
            aria-label={t("legal.back")}
            className="-ml-3 flex size-11 items-center justify-center rounded text-grey-50 transition-colors hover:bg-grey-50/10"
          >
            <Icon name="arrow_back_ios_new" size={20} />
          </button>
          <motion.div
            className="flex items-baseline justify-between gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <h1 className="text-3xl text-grey-50">{t("account.achievements")}</h1>
            <span className="text-xs text-grey-300">
              {unlocked} / {achievements.length}
            </span>
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto max-w-md">
          <AchievementList items={featuredAchievements(achievements, achievements.length)} showDates />
        </div>
      </section>

      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
