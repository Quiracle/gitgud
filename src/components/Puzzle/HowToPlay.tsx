import { motion } from "motion/react";
import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translate";
import { spring } from "../../lib/motion";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Dialog } from "./Dialog";

const STEPS: TranslationKey[] = [
  "howToPlay.step1",
  "howToPlay.step2",
  "howToPlay.step3",
  "howToPlay.step4",
  "howToPlay.step5",
];

/** The rules of the game, shared by the How to play popup and the puzzle help. */
export function HowToPlaySteps({ animate = true }: { animate?: boolean }) {
  const { t } = useI18n();
  return (
    <ol className="flex flex-col gap-2 text-sm text-grey-300">
      {STEPS.map((step, index) => (
        <motion.li
          key={step}
          className="flex gap-2"
          initial={animate ? { opacity: 0, x: -8 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring.soft, delay: 0.1 + index * 0.06 }}
        >
          <span className="text-lime-400">{index + 1}.</span>
          <span>{t(step)}</span>
        </motion.li>
      ))}
    </ol>
  );
}

interface HowToPlayLinkProps {
  onNavigate: (path: string) => void;
  /** Offers the Learn Basics course from the popup; omit where the course is already on screen. */
  learnHref?: string;
  /** Offers to replay the welcome tutorial from the popup. */
  onTutorial?: () => void;
}

/** "How to play" link that opens a quick explainer of the game. */
export function HowToPlayLink({ onNavigate, learnHref, onTutorial }: HowToPlayLinkProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-11 items-center gap-2 self-end text-sm text-grey-50"
      >
        <span className="underline decoration-from-font underline-offset-2">{t("howToPlay.link")}</span>
        <motion.span whileHover={{ rotate: 20 }} transition={spring.snappy} className="flex">
          <Icon name="help" size={16} />
        </motion.span>
      </button>

      <Dialog size="wide" open={open} title={t("howToPlay.title")} onClose={close}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-grey-50">{t("howToPlay.intro")}</p>
          <HowToPlaySteps />
          <p className="text-xs text-grey-400">{t("howToPlay.ranking")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={close}>{t("common.gotIt")}</Button>
          {onTutorial && (
            <Button variant="outline" onClick={() => { close(); onTutorial(); }}>
              {t("howToPlay.tutorial")}
            </Button>
          )}
          {learnHref && (
            <Button variant="tertiary" href={learnHref} onNavigate={(path) => { close(); onNavigate(path); }}>
              {t("howToPlay.learnBasics")}
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
}
