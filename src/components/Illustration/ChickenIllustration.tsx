import type { SemanticState } from "../../engine";

interface ChickenIllustrationProps {
  label: string;
  state: SemanticState;
}

export function ChickenIllustration({ label, state }: ChickenIllustrationProps) {
  const sunglasses = state.sunglasses === true;
  const scarf = state.scarf === "turquoise";
  const hat = state.hat === "blue";

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 sm:text-sm">
          {label}
        </h2>
        <span className="hidden rounded-full bg-slate-800 px-2 py-1 font-mono text-xs text-slate-400 sm:inline">
          repository state
        </span>
      </div>

      <div className="grid min-h-28 place-items-center rounded-lg bg-slate-950 p-3 sm:min-h-44 sm:p-5">
        <div className="text-center">
          {hat && <div className="-mb-3 text-3xl sm:-mb-4 sm:text-4xl">🎩</div>}
          <div className="relative text-5xl sm:text-7xl" aria-label="Illustrated chicken">
            🐔
            {sunglasses && (
              <span className="absolute left-1/2 top-3 -translate-x-1/2 text-2xl sm:top-5 sm:text-3xl">
                🕶️
              </span>
            )}
          </div>
          {scarf && <div className="-mt-2 text-3xl sm:-mt-3 sm:text-4xl">🧣</div>}
        </div>
      </div>

      <p className="mt-2 break-words font-mono text-[10px] leading-relaxed text-slate-400 sm:hidden">
        {Object.entries(state)
          .map(([property, value]) => `${property}: ${String(value)}`)
          .join(" · ")}
      </p>

      <dl className="mt-3 hidden grid-cols-2 gap-2 text-xs sm:grid">
        {Object.entries(state).map(([property, value]) => (
          <div key={property} className="rounded bg-slate-800/80 px-2 py-1.5">
            <dt className="text-slate-500">{property}</dt>
            <dd className="truncate font-mono text-slate-200">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
