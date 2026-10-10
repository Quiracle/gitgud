import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button/Button";
import { useI18n } from "../i18n/I18nProvider";
import { linkedInService } from "../services/linkedin";

interface LinkedInCallbackScreenProps {
  onNavigate: (path: string) => void;
  onReplace: (path: string) => void;
}

/** LinkedIn sends the player back here after the consent screen; the Edge Function stores the connection. */
export function LinkedInCallbackScreen({ onNavigate, onReplace }: LinkedInCallbackScreenProps) {
  const { t } = useI18n();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const providerError = params.get("error");

    if (providerError) {
      // Cancelling on LinkedIn is a choice, not a failure worth a message.
      setError(t(providerError.startsWith("user_cancelled") ? "linkedin.callback.cancelled" : "linkedin.callback.failed"));
      return;
    }
    if (!code || !state) {
      setError(t("linkedin.callback.invalid"));
      return;
    }

    void linkedInService()
      .finish(code, state)
      .then(({ returnPath }) => onReplace(returnPath))
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : t("linkedin.callback.failed"));
      });
  }, [onReplace, t]);

  return (
    <main className="grid min-h-dvh place-items-center bg-green-950 px-6 text-grey-50">
      <section className="flex w-full max-w-[327px] flex-col gap-6 rounded border border-lime-400 p-6" aria-live="polite">
        <h1 className="text-xl leading-[25px]">{t(error ? "linkedin.callback.failedTitle" : "linkedin.callback.connecting")}</h1>
        <p className="text-sm text-grey-300">
          {error ?? t("linkedin.callback.wait")}
        </p>
        {error && <Button onClick={() => onNavigate("/")}>{t("common.backHome")}</Button>}
      </section>
    </main>
  );
}
