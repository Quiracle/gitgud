import { useCallback, useEffect, useState } from "react";
import type { PublicPuzzleDefinition } from "../puzzles";
import { createDailyPuzzleSource, utcDate } from "../services/dailyPuzzles";
import { AppLink } from "../components/AppLink";
import { PuzzleScreen } from "./PuzzleScreen";

interface DailyPuzzleScreenProps {
  onNavigate: (path: string) => void;
}

export function DailyPuzzleScreen({ onNavigate }: DailyPuzzleScreenProps) {
  const date = utcDate();
  const [puzzle, setPuzzle] = useState<PublicPuzzleDefinition>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const source = createDailyPuzzleSource();
      setPuzzle(await source.getByDate(date));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load today's puzzle.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  if (puzzle) {
    return (
      <PuzzleScreen
        key={`${puzzle.id}:${puzzle.version}`}
        puzzle={puzzle}
        eyebrow={`Official daily · ${puzzle.difficulty}`}
        backHref="/"
        backLabel="Home"
        accent="emerald"
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-7 text-center">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-300">Official daily · {date}</p>
        <h1 className="mt-4 text-2xl font-black">{loading ? "Loading today's puzzle…" : "Puzzle unavailable"}</h1>
        {error && <p className="mt-3 text-sm leading-6 text-rose-200">{error}</p>}
        <div className="mt-6 flex justify-center gap-3">
          {!loading && <button onClick={() => void load()} className="min-h-11 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-emerald-950">Try again</button>}
          <AppLink href="/" onNavigate={onNavigate} className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-5 py-3 font-bold">Home</AppLink>
        </div>
      </section>
    </main>
  );
}
