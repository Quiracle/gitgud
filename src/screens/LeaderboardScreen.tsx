import { useEffect, useState } from "react";
import { AppLink } from "../components/AppLink";
import { LeaderboardTable } from "../components/Leaderboard/LeaderboardTable";
import type { PublicPuzzleDefinition } from "../puzzles";
import { createDailyPuzzleSource, utcDate } from "../services/dailyPuzzles";
import { getDailyLeaderboard, type LeaderboardEntry } from "../services/leaderboard";

export function LeaderboardScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [puzzle, setPuzzle] = useState<PublicPuzzleDefinition>();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void createDailyPuzzleSource().getByDate(utcDate())
      .then(async (daily) => {
        setPuzzle(daily);
        setEntries(await getDailyLeaderboard(daily.id, daily.version));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Leaderboard unavailable."));
  }, []);

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <AppLink
          href="/"
          onNavigate={onNavigate}
          className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 py-2 font-bold"
        >
          ← Home
        </AppLink>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
          Official daily
        </p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">Daily leaderboard</h1>
        <p className="mt-3 text-slate-400">
          {puzzle ? `${puzzle.title} · ${puzzle.difficulty}` : "Loading today's ranking…"}
        </p>
        <section className="mt-7 rounded-3xl border border-slate-800 bg-slate-900 p-3 sm:p-6">
          {error ? <p className="p-5 text-rose-200">{error}</p> : <LeaderboardTable entries={entries} />}
        </section>
      </div>
    </main>
  );
}
