import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Rich } from "../../i18n/Rich";
import type { TranslationKey } from "../../i18n/translate";
import { checkGuestName, GUEST_NAME_MAX } from "../../services/leaderboard";
import { Button } from "../Button/Button";

interface GuestJoinFormProps {
  /** The name this device used before, if any. */
  initialName?: string;
  submitting: boolean;
  /** The server's reason the last join failed. */
  error?: string;
  onJoin: (name: string) => void;
  onLogIn: () => void;
}

/** Result popup, guests only: join the daily leaderboard under a name, or log in instead. */
export function GuestJoinForm({ initialName, submitting, error, onJoin, onLogIn }: GuestJoinFormProps) {
  const { t } = useI18n();
  const inputId = useId();
  const messageId = useId();
  const [name, setName] = useState(initialName ?? "");
  const [problem, setProblem] = useState<TranslationKey>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const checked = checkGuestName(name);
    if (!checked.ok) return setProblem(checked.reason === "length" ? "guestName.length" : "guestName.characters");
    setProblem(undefined);
    setName(checked.name);
    onJoin(checked.name);
  }

  const message = problem ?? (error ? serverProblem(error) : undefined);

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor={inputId} className="text-xs text-grey-300">
        {t("guestName.label")}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={name}
          maxLength={GUEST_NAME_MAX + 8}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(undefined);
          }}
          placeholder={t("guestName.placeholder")}
          autoComplete="nickname"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="min-h-11 min-w-0 flex-1 rounded border border-grey-700 bg-green-900 px-3 text-paragraph text-grey-50 outline-none transition-colors placeholder:text-grey-500 focus:border-lime-400 focus:outline focus:outline-1 focus:-outline-offset-2 focus:outline-lime-400"
        />
        <Button type="submit" fullWidth={false} className="shrink-0" disabled={submitting}>
          {submitting ? t("guestName.joining") : t("guestName.join")}
        </Button>
      </div>
      {/* Only problems get a line, so the popup stays short until something needs fixing. */}
      {message && (
        <p id={messageId} className="text-xs text-red-400" role="alert">
          {t(message)}
        </p>
      )}
      <p className="text-xs text-grey-400">
        <Rich text={t("guestName.orLogIn")} tags={{ login: ({ children }) => <LogInLink onClick={onLogIn}>{children}</LogInLink> }} />
      </p>
    </form>
  );
}

/** An inline "log in" link inside result copy. */
export function LogInLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-lime-400 underline underline-offset-2 transition-colors hover:text-lime-300"
    >
      {children}
    </button>
  );
}

function serverProblem(error: string): TranslationKey {
  if (error.includes("Guest name is invalid")) return "guestName.characters";
  if (error.includes("Too many guest names")) return "guestName.rateLimited";
  return "guestName.failed";
}
