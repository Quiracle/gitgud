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
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          {label}
        </h2>
        <span className="rounded-full bg-slate-800 px-2 py-1 font-mono text-xs text-slate-400">
          repository state
        </span>
      </div>

      <div className="grid min-h-44 place-items-center rounded-lg bg-slate-950 p-5">
        <div className="text-center">
          {hat && <div className="-mb-4 text-4xl">🎩</div>}
          <div className="relative text-7xl" aria-label="Illustrated chicken">
            🐔
            {sunglasses && (
              <span className="absolute left-1/2 top-5 -translate-x-1/2 text-3xl">🕶️</span>
            )}
          </div>
          {scarf && <div className="-mt-3 text-4xl">🧣</div>}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
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
