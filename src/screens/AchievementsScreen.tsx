import { motion } from "motion/react";
import { AchievementList, CommandAchievementList } from "../components/Account/AchievementList";
import { Icon } from "../components/Icon/Icon";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { useCommandAchievements } from "../hooks/useLearnedCommands";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { useI18n } from "../i18n/I18nProvider";
import { featuredAchievements } from "../lib/progressInsights";
import { spring } from "../lib/motion";

interface AchievementsScreenProps {
  onNavigate: (path: string) => void;
  /** Puzzle achievements, or the commands the player has learned. */
  kind?: "achievements" | "commands";
}

/** Every achievement of one kind: latest unlocks first, then the locked ones still to earn. */
export function AchievementsScreen({ onNavigate, kind = "achievements" }: AchievementsScreenProps) {
  const { t } = useI18n();
  const { achievements } = useProgressInsights();
  const commands = useCommandAchievements();
  const items = kind === "commands" ? commands : achievements;
  const unlocked = items.filter((item) => item.unlocked).length;

  function back() {
    if (window.history.length > 1) window.history.back();
    else onNavigate("/account");
  }

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md items-center gap-1">
          <button
            type="button"
            onClick={back}
            aria-label={t("legal.back")}
            className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded text-grey-50 transition-colors hover:bg-grey-50/10"
          >
            <Icon name="arrow_back_ios_new" size={20} />
          </button>
          <motion.div
            className="flex min-w-0 flex-1 items-baseline justify-between gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <h1 className="min-w-0 text-3xl text-grey-50">
              {kind === "commands" ? t("account.commandsLearned") : t("account.achievements")}
            </h1>
            <span className="shrink-0 text-xs text-grey-300">
              {unlocked} / {items.length}
            </span>
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto max-w-md">
          {kind === "commands" ? (
            <CommandAchievementList items={featuredAchievements(commands, commands.length)} showDates />
          ) : (
            <AchievementList items={featuredAchievements(achievements, achievements.length)} showDates />
          )}
        </div>
      </section>

      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}
