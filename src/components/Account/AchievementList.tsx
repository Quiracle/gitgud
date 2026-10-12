import { motion } from "motion/react";
import { useI18n } from "../../i18n/I18nProvider";
import type { Achievement, AchievementId } from "../../lib/progressInsights";
import { spring } from "../../lib/motion";
import { Icon } from "../Icon/Icon";
import { PixelChicken, type ChickenLook } from "../Illustration/PixelChicken";

const look = (parts: ChickenLook["parts"], body: ChickenLook["body"] = "default"): ChickenLook => ({
  chicken: true,
  body,
  parts: { crest: "default", ...parts },
});

/** Each achievement gets a chicken dressed for the occasion. */
const ACHIEVEMENT_LOOKS: Record<AchievementId, ChickenLook> = {
  "first-solve": look({}),
  "clean-history": look({ scarf: "turquoise" }),
  "daily-regular": look({ hat: "red" }),
  "halfway-there": look({ longLegs: "default" }),
  "basics-graduate": look({ longLegs: "default", sunglasses: "black" }),
  "quick-draw": look({ longLegs: "default", scarf: "red" }),
  minimalist: look({ crest: "gold" }),
  "never-give-up": look({ hat: "black", scarf: "red" }),
  "time-traveler": look({ hat: "purple", sunglasses: "blue" }),
  "curious-mind": look({ hat: "blue", scarf: "purple" }),
  "on-a-roll": look({ sunglasses: "black" }),
  "week-streak": look({ hat: "gold", scarf: "red" }),
  "daily-devotee": look({ hat: "red", scarf: "gold" }),
  "quarter-century": look({ sunglasses: "black" }, "gold"),
  "month-streak": look({ hat: "gold", sunglasses: "gold", scarf: "purple", longLegs: "default" }),
};

/** Cap the stagger so cards far down a long list don't wait to appear. */
const staggerDelay = (index: number) => Math.min(index, 5) * 0.06;

interface AchievementListProps {
  items: Achievement[];
  /** Show when each unlocked achievement was earned. */
  showDates?: boolean;
}

/**
 * Achievement cards that stagger in as they scroll into view. Each card watches the
 * viewport itself: synced progress can reorder the list after the first reveal, and
 * cards mounted then would otherwise stay invisible but still take up space.
 */
export function AchievementList({ items, showDates = false }: AchievementListProps) {
  const { t, formatDate } = useI18n();

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ ...spring.soft, delay: staggerDelay(index) }}
          className={`flex items-center gap-3 rounded border p-2 ${
            item.unlocked ? "border-lime-500 bg-lime-100" : "border-grey-300 bg-grey-300"
          }`}
        >
          <div className={item.unlocked ? "" : "opacity-40 grayscale"}>
            <PixelChicken look={ACHIEVEMENT_LOOKS[item.id]} size={48} className="rounded" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-paragraph leading-5 text-grey-950">{t(`achievement.${item.id}.title`)}</p>
            <p className="text-xs leading-[15px] text-grey-700">{t(`achievement.${item.id}.description`)}</p>
            {showDates && item.unlockedAt && (
              <p className="text-2xs leading-[13px] text-green-800">
                {t("account.unlockedOn", { date: formatDate(item.unlockedAt, { dateStyle: "medium" }) })}
              </p>
            )}
          </div>
          <span className="sr-only">{item.unlocked ? t("account.unlocked") : t("account.locked")}</span>
          {item.unlocked && (
            <motion.span
              className="flex size-6 shrink-0 items-center justify-center rounded bg-lime-400 text-green-950"
              initial={{ scale: 0, rotate: -90 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ ...spring.bouncy, delay: 0.3 }}
              aria-hidden
            >
              <Icon name="flag_2" size={14} />
            </motion.span>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
