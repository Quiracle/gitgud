import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { COMMAND_LABELS, type CommandAchievement } from "../../lib/learnedCommands";
import type { Achievement, AchievementId } from "../../lib/progressInsights";
import { spring } from "../../lib/motion";
import { Icon } from "../Icon/Icon";
import { CommandBadge } from "./CommandBadge";
import { CommandDetailDialog } from "./CommandDetailDialog";
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

export function AchievementList({ items, showDates = false }: AchievementListProps) {
  const { t } = useI18n();
  return (
    <AchievementCards
      showDates={showDates}
      items={items.map((item) => ({
        ...item,
        title: t(`achievement.${item.id}.title`),
        description: t(`achievement.${item.id}.description`),
        // Locked chickens fade to grey.
        art: (
          <div className={item.unlocked ? "" : "opacity-40 grayscale"}>
            <PixelChicken look={ACHIEVEMENT_LOOKS[item.id]} size={48} className="rounded" />
          </div>
        ),
      }))}
    />
  );
}

interface CommandAchievementListProps {
  items: CommandAchievement[];
  showDates?: boolean;
}

/** Commands learned: the command stays a mystery until the player first types it. */
export function CommandAchievementList({ items, showDates = false }: CommandAchievementListProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<CommandAchievement>();
  return (
    <>
      <AchievementCards
        showDates={showDates}
        items={items.map((item) => ({
          ...item,
          title: item.unlocked ? COMMAND_LABELS[item.id] : t("commandLearned.lockedTitle"),
          titleIsCode: item.unlocked,
          description: item.unlocked ? t(`commandLearned.${item.id}.description`) : t("commandLearned.lockedDescription"),
          art: <CommandBadge unlocked={item.unlocked} />,
          // Learned commands open a short explanation of how they work.
          onOpen: item.unlocked ? () => setOpen(item) : undefined,
        }))}
      />
      <CommandDetailDialog
        command={open?.id}
        unlockedAt={open?.unlockedAt}
        timesTyped={open?.timesTyped}
        onClose={() => setOpen(undefined)}
      />
    </>
  );
}

interface AchievementCard {
  id: string;
  unlocked: boolean;
  unlockedAt?: string;
  title: string;
  /** Render the title as a literal Git command. */
  titleIsCode?: boolean;
  description: string;
  art: ReactNode;
  /** Makes the card a button that opens its detail. */
  onOpen?: () => void;
}

/**
 * Achievement cards that stagger in as they scroll into view. Each card watches the
 * viewport itself: synced progress can reorder the list after the first reveal, and
 * cards mounted then would otherwise stay invisible but still take up space.
 */
function AchievementCards({ items, showDates }: { items: AchievementCard[]; showDates: boolean }) {
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
          className={`rounded border ${item.unlocked ? "border-lime-500 bg-lime-100" : "border-grey-300 bg-grey-300"} ${
            item.onOpen ? "transition-colors hover:bg-lime-200" : ""
          }`}
        >
          <CardBody onOpen={item.onOpen}>
          {item.art}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className={`${item.titleIsCode ? "font-secondary text-code" : "text-paragraph"} leading-5 text-grey-950`}>{item.title}</p>
            <p className="text-xs leading-[15px] text-grey-700">{item.description}</p>
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
          </CardBody>
        </motion.li>
      ))}
    </ul>
  );
}

/** A card's row: a full-size button when it opens a detail, otherwise plain content. */
function CardBody({ onOpen, children }: { onOpen?: () => void; children: ReactNode }) {
  const layout = "flex h-full w-full items-start gap-3 p-2 text-left";
  if (!onOpen) return <div className={layout}>{children}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`${layout} rounded outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-950`}
    >
      {children}
    </button>
  );
}
