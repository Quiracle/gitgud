import { AppLink } from "../components/AppLink";
import { learnBasicsCatalog } from "../puzzles";

export function CourseScreen({ onNavigate }: { onNavigate: (path: string) => void }) {
  const availableCount = learnBasicsCatalog.filter(
    (lesson) => lesson.status === "available",
  ).length;

  return (
    <div className="min-h-dvh bg-[#100b1d] text-slate-100">
      <header className="border-b border-violet-300/15 bg-[#100b1d]/95 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              Guided learning
            </p>
            <h1 className="mt-1 text-xl font-black">Learn Git Basics</h1>
          </div>
          <AppLink
            href="/"
            onNavigate={onNavigate}
            className="inline-flex min-h-11 items-center rounded-xl border border-violet-200/20 px-4 py-2 font-semibold text-violet-100 hover:bg-violet-300/10"
          >
            Home
          </AppLink>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:py-12">
        <section className="rounded-3xl border border-violet-300/20 bg-violet-300/10 p-6 sm:p-8">
          <p className="text-sm font-bold text-violet-200">{availableCount} of 10 playable</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">Build your Git mental model</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Each lesson focuses on one command or behavior. Rebase lessons remain visible but
            locked until that engine feature is implemented.
          </p>
        </section>

        <ol className="mt-8 grid gap-4">
          {learnBasicsCatalog.map((lesson) => (
            <li key={lesson.id}>
              <article
                className={`rounded-2xl border p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 ${
                  lesson.status === "available"
                    ? "border-violet-300/25 bg-slate-950/45"
                    : "border-slate-700/60 bg-slate-900/35 opacity-70"
                }`}
              >
                <div className="flex min-w-0 gap-4">
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-mono font-black ${
                      lesson.status === "available"
                        ? "bg-violet-400 text-violet-950"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {lesson.order}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-100">{lesson.title}</h3>
                      {lesson.status === "coming-soon" && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{lesson.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {lesson.featuredCommands.map((command) => (
                        <code
                          key={command}
                          className="rounded-md bg-black/30 px-2 py-1 text-xs text-violet-200"
                        >
                          {command}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                {lesson.status === "available" && (
                  <AppLink
                    href={`/course/${lesson.id}`}
                    onNavigate={onNavigate}
                    className="mt-5 inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-violet-400 px-5 py-3 font-bold text-violet-950 hover:bg-violet-300 sm:mt-0 sm:w-auto"
                  >
                    Start lesson
                  </AppLink>
                )}
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
