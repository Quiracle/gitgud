import { motion } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { AchievementList } from "../components/Account/AchievementList";
import { CookieSetting } from "../components/Account/CookieSetting";
import { LinkedInSetting } from "../components/Account/LinkedInSetting";
import { LoginDialog } from "../components/Auth/LoginDialog";
import { Button } from "../components/Button/Button";
import { Icon } from "../components/Icon/Icon";
import { PixelChicken, type ChickenLook } from "../components/Illustration/PixelChicken";
import { LanguagePicker } from "../components/LanguagePicker/LanguagePicker";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { SolveTimeChart } from "../components/Stats/SolveTimeChart";
import { StreakTrail } from "../components/Streak/StreakTrail";
import { useAuth } from "../context/AuthContext";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { useI18n } from "../i18n/I18nProvider";
import { spring } from "../lib/motion";
import { featuredAchievements } from "../lib/progressInsights";
import { DISPLAY_NAME_MAX, getDisplayName, updateDisplayName } from "../services/profile";

interface AccountScreenProps {
  onNavigate: (path: string) => void;
}

const look = (parts: ChickenLook["parts"]): ChickenLook => ({ chicken: true, body: "default", parts: { crest: "default", ...parts } });

/** Account shows the latest unlocks; the rest live on the achievements screen. */
const FEATURED_ACHIEVEMENTS = 6;

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" };

/** Account: profile, streak, stats, achievements, and settings. */
export function AccountScreen({ onNavigate }: AccountScreenProps) {
  const { t } = useI18n();
  const { status, user, signOut } = useAuth();
  const signedIn = status === "authenticated" && Boolean(user);
  const insights = useProgressInsights();
  const [loginOpen, setLoginOpen] = useState(false);
  const unlocked = insights.achievements.filter((item) => item.unlocked).length;

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <motion.div
            className="flex items-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            <motion.div
              className="shrink-0"
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={spring.bouncy}
            >
              {signedIn && user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-16 rounded bg-grey-50 object-cover" />
              ) : (
                <PixelChicken look={look({})} size={64} className="rounded" />
              )}
            </motion.div>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-3xl text-grey-50">{signedIn ? user!.displayName : t("account.guest")}</h1>
              <p className="text-xs leading-[15px] text-grey-300">
                {signedIn
                  ? t("account.signedInWith", { provider: PROVIDER_NAMES[user!.provider ?? ""] ?? t("account.yourAccount") })
                  : t("account.savedOnDevice")}
              </p>
            </div>
          </motion.div>

          <StreakTrail
            days={insights.recent}
            label={insights.streak > 0 ? t("streak.days", { count: insights.streak }) : t("streak.start")}
          />

          {!signedIn && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-grey-300">{t("account.logInPitch")}</p>
              <Button onClick={() => setLoginOpen(true)}>{t("nav.logIn")}</Button>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-4">
            {/* The whole title row opens the full stats; -my-2 keeps the 44px target from adding height. */}
            <h2>
              <button
                type="button"
                onClick={() => onNavigate("/account/stats")}
                className="-my-2 flex min-h-11 w-full items-center justify-between gap-3 text-xl leading-[25px] text-green-950 transition-colors hover:text-green-700"
              >
                {t("account.stats")}
                <Icon name="arrow_forward_ios" size={20} />
              </button>
            </h2>
            <SolveTimeChart days={insights.dailyTimes} />
          </div>

          <div className="flex flex-col gap-4">
            <h2>
              <button
                type="button"
                onClick={() => onNavigate("/account/achievements")}
                className="-my-2 flex min-h-11 w-full items-center gap-3 text-xl leading-[25px] text-green-950 transition-colors hover:text-green-700"
              >
                <span className="flex-1 text-left">{t("account.achievements")}</span>
                <span className="text-xs text-grey-700">
                  {unlocked} / {insights.achievements.length}
                </span>
                <Icon name="arrow_forward_ios" size={20} />
              </button>
            </h2>
            <AchievementList items={featuredAchievements(insights.achievements, FEATURED_ACHIEVEMENTS)} />
          </div>

          <div className="flex flex-col gap-4">
            <SectionTitle>{t("account.settings")}</SectionTitle>
            {signedIn && user && <DisplayNameForm userId={user.id} fallback={user.displayName} />}
            <div className="flex items-center justify-between gap-4">
              <span className="text-paragraph text-grey-950">{t("common.language")}</span>
              <LanguagePicker />
            </div>
            {signedIn && <LinkedInSetting />}
            <CookieSetting />
            {signedIn && user && (
              <>
              <Button variant="outline" onClick={() => void signOut().then(() => onNavigate("/"))}>
                {t("account.logOut")}
              </Button>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled
                  className="min-h-11 rounded text-paragraph text-red-700 underline decoration-from-font underline-offset-2 disabled:opacity-50"
                >
                  {t("account.delete")}
                </button>
                <p className="text-center text-xs text-grey-600">{t("account.deleteSoon")}</p>
              </div>
              </>
            )}
          </div>
        </div>
      </section>

      <SiteFooter onNavigate={onNavigate} />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath="/account" />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xl leading-[25px] text-green-950">{children}</h2>;
}

/** Public leaderboard name, so players needn't show their full OAuth name. */
function DisplayNameForm({ userId, fallback }: { userId: string; fallback: string }) {
  const { t } = useI18n();
  const [name, setName] = useState(fallback);
  const [saved, setSaved] = useState(fallback);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    getDisplayName(userId)
      .then((current) => {
        if (!current) return;
        setName(current);
        setSaved(current);
      })
      .catch(() => undefined);
  }, [userId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setError(undefined);
    try {
      const next = await updateDisplayName(userId, name);
      setName(next);
      setSaved(next);
      setState("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("profile.saveFailed"));
      setState("error");
    }
  }

  const unchanged = name.trim() === saved;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <label htmlFor="display-name" className="text-xs text-grey-700">
          {t("profile.nameLabel")}
        </label>
        <InfoTip id="display-name-help" label={t("profile.info")}>
          {t("profile.help")}
        </InfoTip>
      </div>
      <div className="flex gap-2">
        <input
          id="display-name"
          value={name}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(event) => {
            setName(event.target.value);
            setState("idle");
          }}
          autoComplete="nickname"
          aria-describedby="display-name-help"
          className="min-h-11 min-w-0 flex-1 rounded border border-grey-300 bg-grey-50 px-3 text-paragraph text-grey-950 outline-none transition-colors focus:border-lime-500 focus:outline focus:outline-1 focus:-outline-offset-2 focus:outline-lime-500"
        />
        <Button type="submit" fullWidth={false} className="shrink-0" disabled={unchanged || state === "saving"}>
          {state === "saving" ? t("profile.saving") : t("profile.save")}
        </Button>
      </div>
      <div aria-live="polite">
        {(state === "saved" || state === "error") && (
          <motion.p
            key={state}
            className={`text-xs ${state === "error" ? "text-red-700" : "text-grey-600"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {state === "saved" ? t("profile.saved") : error}
          </motion.p>
        )}
      </div>
    </form>
  );
}

/** An info icon that reveals help text on hover, focus, or tap. */
function InfoTip({ id, label, children }: { id: string; label: string; children: string }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;

  return (
    <span className="relative flex" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setPinned(true)}
        onBlur={() => setPinned(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          setPinned(false);
          setHovered(false);
        }}
        // A 44px hit area around the 16px glyph, pulled back so the row keeps its height.
        className="-m-3.5 flex size-11 items-center justify-center text-grey-700 transition-colors hover:text-green-950"
      >
        <Icon name="info" size={16} />
      </button>
      <motion.span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[220px] rounded bg-green-950 px-3 py-2 text-xs text-grey-50"
        style={{ x: "-50%" }}
        initial={false}
        animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
        transition={spring.soft}
      >
        {children}
      </motion.span>
    </span>
  );
}
