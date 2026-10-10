import { useState, type FormEvent } from "react";

export interface TerminalEntry {
  id: number;
  command?: string;
  lines: string[];
  tone?: "normal" | "error" | "success";
}

interface TerminalProps {
  entries: TerminalEntry[];
  disabled?: boolean;
  examples?: string[];
  onCommand: (command: string) => void;
}

const defaultExamples = ["git log --all", "git revert b22", "git cherry-pick s14"];

export function Terminal({
  entries,
  disabled,
  examples = defaultExamples,
  onCommand,
}: TerminalProps) {
  const [command, setCommand] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = command.trim();
    if (!value || disabled) return;
    onCommand(value);
    setCommand("");
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-rose-400" />
        <span className="h-3 w-3 rounded-full bg-amber-300" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs text-slate-500">gitgud terminal — simulated</span>
      </div>

      <div className="terminal-output overflow-y-auto p-4 font-mono text-sm" aria-live="polite">
        {entries.map((entry) => (
          <div key={entry.id} className="mb-3 last:mb-0">
            {entry.command && (
              <div className="whitespace-pre-wrap text-slate-100">
                <span className="mr-2 text-emerald-400">$</span>
                {entry.command}
              </div>
            )}
            {entry.lines.map((line, index) => (
              <div
                key={`${entry.id}-${index}`}
                className={
                  entry.tone === "error"
                    ? "whitespace-pre-wrap text-rose-300"
                    : entry.tone === "success"
                      ? "whitespace-pre-wrap text-emerald-300"
                      : "whitespace-pre-wrap text-slate-400"
                }
              >
                {line || " "}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="sticky bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <label htmlFor="git-command" className="sr-only">
          Git command
        </label>
        <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 ring-1 ring-slate-700 focus-within:ring-emerald-400">
          <span className="font-mono text-emerald-400">$</span>
          <input
            id="git-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            disabled={disabled}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onFocus={(event) => {
              if (window.matchMedia("(max-width: 640px)").matches) {
                window.setTimeout(
                  () => event.currentTarget.scrollIntoView({ block: "center" }),
                  150,
                );
              }
            }}
            placeholder={disabled ? "Puzzle solved" : "Type a Git command…"}
            className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base text-slate-100 outline-none placeholder:text-slate-600 disabled:cursor-not-allowed sm:text-sm"
          />
          <button
            type="submit"
            disabled={!command.trim() || disabled}
            className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {examples.map((example) => (
            <button
              type="button"
              key={example}
              disabled={disabled}
              onClick={() => setCommand(example)}
              className="rounded bg-slate-900 px-2 py-1 font-mono text-xs text-slate-500 hover:text-slate-200 disabled:opacity-40"
            >
              {example}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
