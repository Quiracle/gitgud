import { AppLink } from "../components/AppLink";

export function HomeScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-5 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-black tracking-tight">GitGud</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
            Hackathon preview
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-cyan-300">
            Learn Git by changing history
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">
            Type Git commands. Watch the repository respond.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-400">
            Choose the puzzle preview or open the guided course. These temporary screens make
            each product area directly testable while the final visual design is still pending.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6 sm:p-8">
            <span className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-950">
              Puzzle
            </span>
            <h2 className="mt-5 text-2xl font-black">Official daily challenge</h2>
            <p className="mt-2 text-slate-300">
              Solve today's shared AI-generated chicken puzzle with the Git simulator.
            </p>
            <AppLink
              href="/play"
              onNavigate={onNavigate}
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-400 px-5 py-3 font-bold text-emerald-950 hover:bg-emerald-300"
            >
              Open puzzle
            </AppLink>
          </section>

          <section className="rounded-3xl border border-violet-400/30 bg-violet-400/10 p-6 sm:p-8">
            <span className="rounded-full bg-violet-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-950">
              Course
            </span>
            <h2 className="mt-5 text-2xl font-black">Learn Git Basics</h2>
            <p className="mt-2 text-slate-300">
              Browse ten lesson slots and play the seven commands currently supported.
            </p>
            <AppLink
              href="/course"
              onNavigate={onNavigate}
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-violet-400 px-5 py-3 font-bold text-violet-950 hover:bg-violet-300"
            >
              Open course
            </AppLink>
          </section>
        </div>
      </main>
    </div>
  );
}
