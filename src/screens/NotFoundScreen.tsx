import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "../components/Button/Button";
import { PixelChicken } from "../components/Illustration/PixelChicken";
import { useI18n } from "../i18n/I18nProvider";
import { spring } from "../lib/motion";
import { randomChickenLook } from "../lib/randomChicken";

/** Unknown route: the pop-up panel with a freshly dressed chicken on every visit. */
export function NotFoundScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n();
  const [look] = useState(() => randomChickenLook());

  return (
    <main className="flex min-h-dvh items-center justify-center bg-green-950 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <motion.section
        className="flex w-full max-w-[327px] flex-col items-center gap-6 rounded border border-lime-400 bg-green-950 p-6 text-center"
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        <motion.div initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring.bouncy, delay: 0.12 }}>
          <PixelChicken look={look} size={96} className="rounded" />
        </motion.div>
        <div className="flex flex-col gap-2">
          <p className="font-secondary text-sm text-lime-400">404</p>
          <h1 className="text-xl leading-[25px] text-grey-50">{t("notFound.title")}</h1>
        </div>
        <Button href="/" onNavigate={onNavigate}>
          {t("common.returnHome")}
        </Button>
      </motion.section>
    </main>
  );
}
