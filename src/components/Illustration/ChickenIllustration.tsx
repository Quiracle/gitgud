import type { SemanticState } from "../../engine";
import { chickenLookFromState, PixelChicken } from "./PixelChicken";

interface ChickenIllustrationProps {
  label: string;
  state: SemanticState;
}

export function ChickenIllustration({ label, state }: ChickenIllustrationProps) {
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

      <div className="grid min-h-28 place-items-center rounded-lg bg-grey-50 p-2 sm:min-h-44">
        <PixelChicken look={chickenLookFromState(state)} size={160} className="h-28 w-28 sm:h-40 sm:w-40" />
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
