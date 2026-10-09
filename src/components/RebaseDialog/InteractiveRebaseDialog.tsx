import { useState } from "react";
import type { InteractiveRebaseTodoEntry, RebaseTodoItem } from "../../engine";

interface InteractiveRebaseDialogProps {
  onto: string;
  branch: string;
  todo: InteractiveRebaseTodoEntry[];
  onConfirm: (todo: RebaseTodoItem[]) => void;
  onCancel: () => void;
}

/**
 * Replaces Git's todo editor. Commits stay in order; each one after the first
 * can be kept (pick) or folded into the commit above it (squash).
 */
export function InteractiveRebaseDialog({
  onto,
  branch,
  todo,
  onConfirm,
  onCancel,
}: InteractiveRebaseDialogProps) {
  const [actions, setActions] = useState(() => todo.map((item) => item.action));

  function toggle(index: number) {
    setActions((current) =>
      current.map((action, itemIndex) =>
        itemIndex === index ? (action === "pick" ? "squash" : "pick") : action,
      ),
    );
  }

  function confirm() {
    onConfirm(todo.map((item, index) => ({ action: actions[index], commit: item.commit })));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rebase-dialog-title"
    >
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-4 py-3">
          <h2 id="rebase-dialog-title" className="font-bold text-slate-100">
            Interactive rebase
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Replaying <span className="font-mono text-slate-200">{branch}</span> onto{" "}
            <span className="font-mono text-slate-200">{onto}</span>, oldest commit first.
            Squash folds a commit into the one above it.
          </p>
        </div>

        <ol className="flex-1 space-y-2 overflow-y-auto p-4">
          {todo.map((item, index) => {
            const action = actions[index];
            const locked = index === 0;
            return (
              <li
                key={item.commit}
                className="flex items-center gap-3 rounded-lg bg-slate-950/60 p-2"
              >
                <button
                  type="button"
                  onClick={() => toggle(index)}
                  disabled={locked}
                  aria-label={`${action} ${item.commit}${locked ? " (the first commit must be picked)" : ""}`}
                  className={`min-h-11 w-24 shrink-0 rounded-md font-mono text-sm font-semibold disabled:cursor-not-allowed ${
                    action === "pick"
                      ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40"
                      : "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/40"
                  } ${locked ? "opacity-70" : "hover:brightness-125"}`}
                >
                  {action}
                </button>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-slate-200">{item.commit}</p>
                  <p className="truncate text-sm text-slate-400">{item.message}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex gap-2 border-t border-slate-800 p-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-slate-600 px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="min-h-11 flex-1 rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Start rebase
          </button>
        </div>
      </div>
    </div>
  );
}
