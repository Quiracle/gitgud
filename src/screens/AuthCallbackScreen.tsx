import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button/Button";
import { PixelChicken, type ChickenLook } from "../components/Illustration/PixelChicken";
import { useI18n } from "../i18n/I18nProvider";
import { spring } from "../lib/motion";
import { finishOAuthSignIn, normalizeReturnPath } from "../services/auth";

interface AuthCallbackScreenProps {
  onNavigate: (path: string) => void;
  onReplace: (path: string) => void;
}

const CHICKEN: ChickenLook = { chicken: true, body: "default", parts: { crest: "default" } };

/** OAuth return: the Figma pop-up panel, standing alone on the dark page while the session is validated. */
export function AuthCallbackScreen({ onNavigate, onReplace }: AuthCallbackScreenProps) {
  const started = useRef(false);
  const [error, setError] = useState<string>();
  const { t } = useI18n();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") ?? params.get("error");
    const code = params.get("code");
    const nextPath = normalizeReturnPath(params.get("next"));

    if (providerError) {
      console.warn("OAuth provider error:", providerError);
      setError(t("auth.providerError"));
      return;
    }
    if (!code) {
      setError(t("auth.noCode"));
      return;
    }

    void finishOAuthSignIn(code)
      .then(() => onReplace(nextPath))
      .catch((reason) => {
        console.warn(reason);
        setError(t("auth.sessionFailed"));
      });
  }, [onReplace]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-green-950 px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <motion.section
        className="flex w-full max-w-[327px] flex-col items-center gap-6 rounded border border-lime-400 bg-green-950 p-6 text-center"
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={spring.bouncy}
        aria-live="polite"
      >
        {/* Hops while waiting; settles once there is an answer. */}
        <motion.div
          animate={error ? { y: 0 } : { y: [0, -8, 0] }}
          transition={error ? spring.snappy : { duration: 0.7, repeat: Infinity, ease: "easeInOut" }}
        >
          <PixelChicken look={CHICKEN} size={72} className="rounded" />
        </motion.div>
        <div className="flex flex-col gap-3">
          <h1 className="text-xl leading-[25px] text-grey-50">{error ? t("auth.failedTitle") : t("auth.validating")}</h1>
          {!error && <p className="text-sm text-grey-300">{t("auth.wait")}</p>}
        </div>
        <AnimatePresence>
          {error && (
            <motion.div
              className="flex w-full flex-col gap-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={spring.snappy}
            >
              <p role="alert" className="rounded border border-red-500/60 bg-red-500/10 p-3 text-left text-sm text-red-200">
                {error}
              </p>
              <Button href="/" onNavigate={onNavigate}>
                {t("common.returnHome")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}
