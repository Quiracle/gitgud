import { animate, motion, useMotionValue, useTransform, type Variants } from "motion/react";
import { useEffect, useState, type FormEvent } from "react";
import { LoginDialog } from "../components/Auth/LoginDialog";
import { Button } from "../components/Button/Button";
import { Icon } from "../components/Icon/Icon";
import { PixelChicken, type ChickenLook } from "../components/Illustration/PixelChicken";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { StreakTrail } from "../components/Streak/StreakTrail";
import { useAuth } from "../context/AuthContext";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { formatDuration } from "../lib/format";
import { spring } from "../lib/motion";
import type { AchievementId } from "../lib/progressInsights";
import { getSyncedDailyStats, type SyncedDailyStats } from "../services/leaderboard";
import { DISPLAY_NAME_MAX, getDisplayName, updateDisplayName } from "../services/profile";

interface AccountScreenProps {
  onNavigate: (path: string) => void;
}

const look = (parts: ChickenLook["parts"]): ChickenLook => ({ chicken: true, body: "default", parts: { crest: "default", ...parts } });

/** Each achievement gets a chicken dressed for the occasion. */
const ACHIEVEMENT_LOOKS: Record<AchievementId, ChickenLook> = {
  "first-solve": look({}),
  "clean-history": look({ scarf: "turquoise" }),
  "daily-regular": look({ hat: "red" }),
  "on-a-roll": look({ sunglasses: "black" }),
  "week-streak": look({ hat: "gold", scarf: "red" }),
  "basics-graduate": look({ longLegs: "default", sunglasses: "black" }),
};

const PROVIDER_NAMES: Record<string, string> = { google: "Google", github: "GitHub" };

/** Account: profile, streak, stats, achievements, and settings. */
export function AccountScreen({ onNavigate }: AccountScreenProps) {
  const { status, user, signOut } = useAuth();
  const signedIn = status === "authenticated" && Boolean(user);
  const insights = useProgressInsights();
  const [loginOpen, setLoginOpen] = useState(false);
  const [synced, setSynced] = useState<SyncedDailyStats>();

  useEffect(() => {
    if (!signedIn) return setSynced(undefined);
    getSyncedDailyStats().then(setSynced).catch(() => setSynced(undefined));
  }, [signedIn]);

  // Local progress plus what the server knows about ranked dailies on other devices.
  const local = insights.stats;
  const dailies = Math.max(local.completedDailies, synced?.completedDailies ?? 0);
  const bestTimes = [local.bestElapsedMs, synced?.bestElapsedMs].filter((value): value is number => value !== undefined);
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
              className="shrink-0 rounded border border-lime-400 p-1"
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
              <h1 className="truncate text-3xl text-grey-50">{signedIn ? user!.displayName : "Guest player"}</h1>
              <p className="text-xs leading-[15px] text-grey-300">
                {signedIn
                  ? `Signed in with ${PROVIDER_NAMES[user!.provider ?? ""] ?? "your account"}`
                  : "Progress is saved on this device"}
              </p>
            </div>
          </motion.div>

          <StreakTrail
            days={insights.recent}
            label={insights.streak > 0 ? `${insights.streak}-day${insights.streak === 1 ? "" : "s"} streak!` : "Start your streak!"}
          />

          {!signedIn && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-grey-300">Log in to keep your progress on every device and join the daily leaderboard.</p>
              <Button onClick={() => setLoginOpen(true)}>Log in</Button>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-8">
          <div className="flex flex-col gap-4">
            <SectionTitle>Your stats</SectionTitle>
            <motion.div
              className="grid grid-cols-2 gap-2"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              <StatTile label="Puzzles solved" value={local.completedPuzzles} />
              <StatTile label="Daily solves" value={dailies} />
              <StatTile label="Lessons done" value={local.completedLessons} suffix={` / ${insights.lessonsTotal}`} />
              <StatTile
                label="Best time"
                value={bestTimes.length ? Math.min(...bestTimes) : undefined}
                format={(ms) => formatDuration(ms)}
              />
            </motion.div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <SectionTitle>Achievements</SectionTitle>
              <span className="text-xs text-grey-700">
                {unlocked} / {insights.achievements.length}
              </span>
            </div>
            <motion.ul
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
            >
              {insights.achievements.map((item) => (
                <motion.li
                  key={item.id}
                  variants={cardVariants}
                  className={`flex items-center gap-3 rounded border p-2 ${
                    item.unlocked ? "border-lime-500 bg-lime-100" : "border-grey-300 bg-grey-300"
                  }`}
                >
                  <div className={item.unlocked ? "" : "opacity-40 grayscale"}>
                    <PixelChicken look={ACHIEVEMENT_LOOKS[item.id]} size={48} className="rounded" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-paragraph leading-5 text-grey-950">{item.title}</p>
                    <p className="text-xs leading-[15px] text-grey-700">{item.description}</p>
                  </div>
                  <span className="sr-only">{item.unlocked ? "Unlocked" : "Locked"}</span>
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
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {signedIn && user && (
            <div className="flex flex-col gap-4">
              <SectionTitle>Settings</SectionTitle>
              <DisplayNameForm userId={user.id} fallback={user.displayName} />
              <Button variant="outline" onClick={() => void signOut().then(() => onNavigate("/"))}>
                Log out
              </Button>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled
                  className="min-h-11 rounded text-paragraph text-red-700 underline decoration-from-font underline-offset-2 disabled:opacity-50"
                >
                  Delete account
                </button>
                <p className="text-center text-xs text-grey-600">
                  Account deletion isn't available yet. It will remove your progress and leaderboard entries.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath="/account" />
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xl leading-[25px] text-green-950">{children}</h2>;
}

interface StatTileProps {
  label: string;
  value?: number;
  suffix?: string;
  format?: (value: number) => string;
}

/** A stat that counts up when it scrolls into view. */
function StatTile({ label, value, suffix = "", format = (n) => Math.round(n).toString() }: StatTileProps) {
  const count = useMotionValue(0);
  const text = useTransform(count, (latest) => format(latest));
  useEffect(() => {
    if (value === undefined) return;
    const control = animate(count, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => control.stop();
  }, [count, value]);

  return (
    <motion.div variants={cardVariants} className="flex flex-col gap-1 rounded border border-grey-300 bg-grey-300 p-3">
      <p className="text-2xl leading-8 text-grey-950">
        {value === undefined ? "—" : <motion.span>{text}</motion.span>}
        {value !== undefined && suffix && <span className="text-paragraph text-grey-700">{suffix}</span>}
      </p>
      <p className="text-xs leading-[15px] text-grey-700">{label}</p>
    </motion.div>
  );
}

/** Public leaderboard name, so players needn't show their full OAuth name. */
function DisplayNameForm({ userId, fallback }: { userId: string; fallback: string }) {
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
      setError(reason instanceof Error ? reason.message : "Couldn't save your name.");
      setState("error");
    }
  }

  const unchanged = name.trim() === saved;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="display-name" className="text-xs text-grey-700">
        Leaderboard name
      </label>
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
          className="min-h-11 min-w-0 flex-1 rounded border border-grey-300 bg-grey-50 px-3 text-paragraph text-grey-950 outline-none transition-colors focus:border-lime-500 focus:outline focus:outline-1 focus:-outline-offset-2 focus:outline-lime-500"
        />
        <Button type="submit" className="w-auto shrink-0 px-5" disabled={unchanged || state === "saving"}>
          {state === "saving" ? "Saving…" : "Save"}
        </Button>
      </div>
      <motion.p
        key={state}
        className={`text-xs ${state === "error" ? "text-red-700" : "text-grey-600"}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        aria-live="polite"
      >
        {state === "saved" ? "Saved. Your new name shows on the leaderboard." : state === "error" ? error : "Shown on the leaderboard instead of your full name."}
      </motion.p>
    </form>
  );
}
