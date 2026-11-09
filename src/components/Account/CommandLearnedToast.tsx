import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLearnedCommands } from "../../hooks/useLearnedCommands";
import { useI18n } from "../../i18n/I18nProvider";
import { COMMAND_LABELS, newlyLearned, type LearnableCommand } from "../../lib/learnedCommands";
import { spring } from "../../lib/motion";
import { CommandBadge } from "./CommandBadge";

const VISIBLE_MS = 3500;

/**
 * Drops in from the top the first time the player types a command. Commands already learned
 * when the app opened, including ones backfilled from older transcripts, never announce.
 */
export function CommandLearnedToast() {
  const { t } = useI18n();
  const learned = useLearnedCommands();
  const seen = useRef(learned);
  const [shown, setShown] = useState<LearnableCommand>();

  useEffect(() => {
    const fresh = newlyLearned(seen.current, learned);
    seen.current = learned;
    if (fresh.length > 0) setShown(fresh.at(-1));
  }, [learned]);

  useEffect(() => {
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(undefined), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(12px+env(safe-area-inset-top))]"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown}
            className="flex w-full max-w-md items-center gap-3 rounded border border-lime-500 bg-green-950 p-2 shadow-lg"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={spring.bouncy}
          >
            <CommandBadge unlocked size={40} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-xs leading-[15px] text-grey-300">{t("commandLearned.toast")}</p>
              <p className="truncate font-secondary text-code leading-5 text-lime-400">{COMMAND_LABELS[shown]}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
