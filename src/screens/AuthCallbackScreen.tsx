import { useEffect, useRef, useState } from "react";
import { AppLink } from "../components/AppLink";
import { useI18n } from "../i18n/I18nProvider";
import { finishOAuthSignIn, normalizeReturnPath } from "../services/auth";

interface AuthCallbackScreenProps {
  onNavigate: (path: string) => void;
  onReplace: (path: string) => void;
}

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
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">{t("auth.account")}</p>
        <h1 className="mt-4 text-2xl font-black">
          {error ? t("auth.failedTitle") : t("auth.validating")}
        </h1>
        {error ? (
          <>
            <p className="mt-3 text-sm leading-6 text-rose-200">{error}</p>
            <AppLink
              href="/"
              onNavigate={onNavigate}
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 font-bold text-slate-950"
            >
              {t("common.returnHome")}
            </AppLink>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {t("auth.wait")}
          </p>
        )}
      </section>
    </main>
  );
}
