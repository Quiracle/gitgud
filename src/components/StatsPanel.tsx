import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { formatElapsed, getSyncedDailyStats, type SyncedDailyStats } from "../services/leaderboard";
import { browserProgressStore } from "../storage/progress";

export function StatsPanel() {
  const { status } = useAuth();
  const [localStats] = useState(() => browserProgressStore().stats());
  const [synced, setSynced] = useState<SyncedDailyStats>();

  useEffect(() => {
    if (status !== "authenticated") return;
    void getSyncedDailyStats().then(setSynced).catch(() => setSynced(undefined));
  }, [status]);

  const completedPuzzles = Math.max(
    localStats.completedPuzzles,
    (synced?.completedDailies ?? 0) + localStats.completedLessons,
  );
  const bestTimes = [localStats.bestElapsedMs, synced?.bestElapsedMs].filter(
    (value): value is number => value !== undefined,
  );
  const bestElapsedMs = bestTimes.length ? Math.min(...bestTimes) : undefined;

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-900/70 p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Your statistics</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Puzzles" value={completedPuzzles.toString()} />
        <Stat label="Daily solves" value={(synced?.completedDailies ?? localStats.completedDailies).toString()} />
        <Stat label="Lessons" value={localStats.completedLessons.toString()} />
        <Stat
          label="Best time"
          value={bestElapsedMs === undefined ? "—" : formatElapsed(bestElapsedMs)}
        />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Guest and lesson statistics live on this device. Signed-in daily bests are synced.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-950/70 p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
