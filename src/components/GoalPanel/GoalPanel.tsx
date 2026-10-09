import type { ValidationResult } from "../../engine";

interface GoalPanelProps {
  objectives: string[];
  validation: ValidationResult;
}

export function GoalPanel({ objectives, validation }: GoalPanelProps) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="font-semibold text-slate-100">Objectives</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {objectives.map((objective) => (
          <li key={objective} className="flex gap-2">
            <span className="text-slate-500">○</span>
            <span>{objective}</span>
          </li>
        ))}
      </ul>

      {!validation.solved && validation.unmet.length > 0 && (
        <details className="mt-4 rounded-lg bg-slate-950 p-3 text-xs text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-300">
            Current unmet invariants
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {validation.unmet.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
