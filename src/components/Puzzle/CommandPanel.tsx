import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { getCommandSuggestion } from "../../engine";
import type { CommandOutcome } from "../../hooks/usePuzzleSession";
import { useI18n } from "../../i18n/I18nProvider";
import { spring } from "../../lib/motion";
import { Icon } from "../Icon/Icon";

/** One submitted command (or system message) and its output in the run transcript. */
export interface TerminalEntry {
  id: number;
  command?: string;
  lines: string[];
  tone?: "normal" | "error" | "success" | "info";
}

interface CommandPanelProps {
  entries: TerminalEntry[];
  onCommand: (command: string) => CommandOutcome;
  command: string;
  onCommandChange: (command: string) => void;
  /** Incremented when a graph-card tap should return focus to the composer. */
  focusRequest?: number;
  /** Mobile: collapsed shows the latest line; expanded shows the full history. */
  expanded: boolean;
  onToggle?: () => void;
  onHelp?: () => void;
  /** Desktop side panel: always shows history, no toggle. */
  docked?: boolean;
  disabled?: boolean;
  disabledPlaceholder?: string;
  /** Action beside the input, such as Share once the puzzle is solved. */
  trailing?: ReactNode;
}

type Flash = "idle" | "error" | "solved";

/** Figma terminal (nodes 24:60686 collapsed, 24:87399 history). */
export function CommandPanel({
  entries,
  onCommand,
  command,
  onCommandChange,
  focusRequest = 0,
  expanded,
  onToggle,
  onHelp,
  docked = false,
  disabled = false,
  disabledPlaceholder,
  trailing,
}: CommandPanelProps) {
  const { t } = useI18n();
  const [flash, setFlash] = useState<Flash>("idle");
  const recall = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const showHistory = docked || expanded;
  const typed = entries.filter((entry) => entry.command).map((entry) => entry.command!);
  const suggestion = disabled ? null : getCommandSuggestion(command);
  const suggestionSuffix = suggestion?.slice(command.trimStart().length) ?? "";

  useEffect(() => {
    if (flash === "idle") return;
    const timer = window.setTimeout(() => setFlash("idle"), flash === "error" ? 650 : 1400);
    return () => window.clearTimeout(timer);
  }, [flash]);

  useEffect(() => {
    if (focusRequest > 0) input.current?.focus();
  }, [focusRequest]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = command.trim();
    if (!value || disabled) return;
    const outcome = onCommand(value);
    setFlash(outcome.solved ? "solved" : outcome.ok ? "idle" : "error");
    onCommandChange("");
    recall.current = null;
  }

  function acceptSuggestion() {
    if (!suggestion) return;
    onCommandChange(suggestion);
    recall.current = null;
    input.current?.focus();
  }

  // Up/Down walk back through previously typed commands, like a shell.
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Tab" && suggestion) {
      event.preventDefault();
      acceptSuggestion();
      return;
    }
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (!typed.length) return;
    event.preventDefault();
    const last = typed.length - 1;
    const current = recall.current ?? typed.length;
    const next = event.key === "ArrowUp" ? Math.max(0, current - 1) : Math.min(typed.length, current + 1);
    recall.current = next > last ? null : next;
    onCommandChange(next > last ? "" : typed[next]);
  }

  const border =
    flash === "error"
      ? "border-red-500 outline-red-500"
      : flash === "solved"
        ? "border-lime-300 outline-lime-300"
        : "border-lime-400 outline-lime-400";

  return (
    <div className={`flex min-h-0 flex-col bg-green-950 px-4 py-3 ${showHistory ? "h-full gap-2" : "gap-4"}`}>
      {showHistory ? (
        <>
          {!docked && (
            <div className="flex items-center justify-between">
              <button type="button" onClick={onHelp} className="flex min-h-11 items-center gap-2 text-sm text-grey-50">
                <span className="underline decoration-from-font underline-offset-2">{t("howToPlay.link")}</span>
                <Icon name="help" size={16} />
              </button>
              <ToggleButton expanded onToggle={onToggle} />
            </div>
          )}
          <History entries={entries} />
        </>
      ) : (
        <LatestLine entries={entries} />
      )}

      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <label htmlFor="git-command" className="sr-only">
          {t("terminal.inputLabel")}
        </label>
        <motion.div
          className={`relative flex min-w-0 flex-1 rounded border bg-green-900 transition-colors duration-200 focus-within:outline focus-within:outline-1 focus-within:-outline-offset-2 ${border}`}
          animate={flash === "solved" ? { boxShadow: ["0 0 0 0 rgb(158 232 43 / 0.6)", "0 0 0 10px rgb(158 232 43 / 0)"] } : {}}
          transition={{ duration: 0.8 }}
        >
          {suggestion && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex min-w-0 items-center overflow-hidden whitespace-pre p-3 font-secondary text-code"
            >
              <span className="invisible">{command}</span>
              <span className="text-grey-400/50">{suggestionSuffix}</span>
            </div>
          )}
          <input
            ref={input}
            id="git-command"
            value={command}
            onChange={(event) => {
              onCommandChange(event.target.value);
              recall.current = null;
            }}
            onKeyDown={onKeyDown}
            disabled={disabled}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={disabled ? disabledPlaceholder ?? t("terminal.solvedPlaceholder") : t("terminal.placeholder")}
            aria-describedby={suggestion ? "git-command-suggestion" : undefined}
            className="relative min-w-0 flex-1 bg-transparent p-3 font-secondary text-code text-grey-50 outline-none placeholder:text-grey-400 disabled:cursor-not-allowed"
          />
        </motion.div>
        {trailing}
        {!docked && !showHistory && <ToggleButton expanded={false} onToggle={onToggle} />}
        {suggestion && (
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={acceptSuggestion}
            aria-label={t("terminal.useSuggestion", { command: suggestion })}
            className="flex min-h-11 basis-full items-center rounded border border-grey-700 px-3 font-secondary text-code text-grey-300 opacity-70 transition hover:border-lime-400 hover:text-lime-400 hover:opacity-100 active:bg-green-900 lg:hidden"
          >
            {suggestion}
          </button>
        )}
        {suggestion && (
          <span id="git-command-suggestion" className="sr-only">
            {t("terminal.autocompleteHint", { command: suggestion })}
          </span>
        )}
      </form>
    </div>
  );
}

function ToggleButton({ expanded, onToggle }: { expanded: boolean; onToggle?: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={expanded ? t("terminal.hideHistory") : t("terminal.showHistory")}
      aria-expanded={expanded}
      className="-mr-3 flex size-11 shrink-0 items-center justify-center text-lime-400 transition-colors hover:text-lime-300"
    >
      <motion.span className="flex" initial={false} animate={{ rotate: expanded ? -90 : 90 }} transition={spring.snappy}>
        <Icon name="arrow_back_ios_new" size={20} />
      </motion.span>
    </button>
  );
}

function lineTone(tone: TerminalEntry["tone"]) {
  if (tone === "error") return "text-red-400";
  if (tone === "success") return "text-lime-400";
  return tone === "info" ? "text-yellow-300" : "text-grey-400";
}

/** The newest line of output, sliding up as it changes. */
function LatestLine({ entries }: { entries: TerminalEntry[] }) {
  const { t } = useI18n();
  const last = entries.at(-1);
  const text = !last
    ? t("terminal.empty")
    : last.lines.length
      ? last.lines[last.lines.length - 1]
      : `${t("terminal.you")} ${last.command}`;
  const tone = !last ? "text-grey-400" : last.lines.length ? lineTone(last.tone) : "text-grey-50";

  return (
    <div className="relative h-5 overflow-hidden font-secondary text-code leading-5" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.p
          key={`${entries.length}:${text}`}
          className={`absolute inset-x-0 truncate ${tone}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={spring.snappy}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

/** Full transcript, newest at the bottom. */
function History({ entries }: { entries: TerminalEntry[] }) {
  const { t } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <div
      ref={scroller}
      className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto font-secondary text-code leading-6"
      aria-live="polite"
    >
      <div className="mt-auto flex flex-col gap-1">
        {entries.length === 0 && <p className="text-grey-400">{t("terminal.noCommands")}</p>}
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.snappy}
            className="break-words"
          >
            {entry.command && <p className="text-grey-50">{t("terminal.you")} {entry.command}</p>}
            {entry.lines.map((line, index) => (
              <p key={index} className={`whitespace-pre-wrap ${lineTone(entry.tone)}`}>
                {line || " "}
              </p>
            ))}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
