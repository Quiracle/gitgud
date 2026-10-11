import { animate, motion, useMotionValue, useTransform, type Variants } from "motion/react";
import { useEffect, useState } from "react";
import { Icon } from "../components/Icon/Icon";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { SolveTimeChart } from "../components/Stats/SolveTimeChart";
import { useAuth } from "../context/AuthContext";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { useI18n } from "../i18n/I18nProvider";
import { formatDuration } from "../lib/format";
import { spring } from "../lib/motion";
import { getSyncedDailyStats, type SyncedDailyStats } from "../services/leaderboard";

interface StatsScreenProps {
  onNavigate: (path: string) => void;
}

/** Your stats: the daily solve-time graph followed by the totals. */
export function StatsScreen({ onNavigate }: StatsScreenProps) {
  const { t, formatNumber } = useI18n();
  const { status, user } = useAuth();
  const signedIn = status === "authenticated" && Boolean(user);
  const insights = useProgressInsights();
  const [synced, setSynced] = useState<SyncedDailyStats>();

  useEffect(() => {
    if (!signedIn) return setSynced(undefined);
    getSyncedDailyStats().then(setSynced).catch(() => setSynced(undefined));
  }, [signedIn]);

  // Local progress plus what the server knows about ranked dailies on other devices.
  const local = insights.stats;
  const dailies = Math.max(local.completedDailies, synced?.completedDailies ?? 0);
  const bestTimes = [local.bestElapsedMs, synced?.bestElapsedMs].filter((value): value is number => value !== undefined);

  function back() {
    if (window.history.length > 1) window.history.back();
    else onNavigate("/account");
  }

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(24px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <button
            type="button"
            onClick={back}
            aria-label={t("legal.back")}
            className="-ml-3 flex size-11 items-center justify-center rounded text-grey-50 transition-colors hover:bg-grey-50/10"
          >
            <Icon name="arrow_back_ios_new" size={20} />
          </button>
          <motion.h1
            className="text-3xl text-grey-50"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.soft}
          >
            {t("account.stats")}
          </motion.h1>
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <SolveTimeChart days={insights.dailyTimes} />
          <motion.div
            className="grid grid-cols-2 gap-2"
            variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
          >
            <StatTile label={t("account.puzzlesSolved")} value={local.completedPuzzles} format={(n) => formatNumber(Math.round(n))} />
            <StatTile label={t("account.dailySolves")} value={dailies} format={(n) => formatNumber(Math.round(n))} />
            <StatTile
              label={t("account.lessonsDone")}
              value={local.completedLessons}
              suffix={` / ${formatNumber(insights.lessonsTotal)}`}
              format={(n) => formatNumber(Math.round(n))}
            />
            <StatTile
              label={t("account.bestTime")}
              value={bestTimes.length ? Math.min(...bestTimes) : undefined}
              format={(ms) => formatDuration(ms)}
            />
          </motion.div>
        </div>
      </section>

      <SiteFooter onNavigate={onNavigate} />
    </div>
  );
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

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
