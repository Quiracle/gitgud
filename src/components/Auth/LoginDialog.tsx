import { AnimatePresence, motion } from "motion/react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import { spring } from "../../lib/motion";
import type { OAuthProvider } from "../../services/auth";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Dialog } from "../Puzzle/Dialog";

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where to land after the provider redirects back. */
  returnPath: string;
}

/* Figma marks: Google (node 43:151218) and GitHub's Invertocat (node 43:151217). The
   Invertocat file includes GitHub's required clear space, so it renders larger. */
const PROVIDERS: { id: OAuthProvider; name: string; icon: "google" | "github"; size: number }[] = [
  { id: "google", name: "Google", icon: "google", size: 20 },
  { id: "github", name: "GitHub", icon: "github", size: 30 },
];

/** Sign-in popup: Google or GitHub through Supabase Auth. Guest play stays available. */
export function LoginDialog({ open, onClose, returnPath }: LoginDialogProps) {
  const { configured, error, pendingProvider, status, signIn, clearError } = useAuth();
  const busy = status === "loading" || Boolean(pendingProvider);
  const { t } = useI18n();

  return (
    <Dialog open={open} title={t("nav.logIn")} onClose={onClose}>
      <p className="text-sm text-grey-300">{t("login.pitch")}</p>
      {configured ? (
        <div className="flex flex-col gap-2">
          {PROVIDERS.map((provider, index) => (
            <Button
              key={provider.id}
              variant={index === 0 ? "primary" : "outline"}
              disabled={busy}
              onClick={() => void signIn(provider.id, returnPath)}
            >
              <Icon name={provider.icon} size={provider.size} className="-my-1.5 mr-2" />
              {pendingProvider === provider.id ? t("login.opening") : t("login.continueWith", { provider: provider.name })}
            </Button>
          ))}
        </div>
      ) : (
        <p className="rounded border border-grey-700 p-3 text-sm text-grey-300">
          {t("login.unavailable")}
        </p>
      )}
      <AnimatePresence>
        {error && (
          <motion.div
            className="flex items-start justify-between gap-3 rounded border border-red-500/60 bg-red-500/10 p-3 text-sm text-red-200"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={spring.snappy}
            role="alert"
          >
            <p>{error}</p>
            <button type="button" onClick={clearError} className="text-red-200 hover:text-red-100" aria-label={t("login.dismissError")}>
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
