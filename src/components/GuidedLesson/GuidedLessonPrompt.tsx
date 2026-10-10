import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { spring } from "../../lib/motion";
import {
  GUIDED_GOAL_MAX_LENGTH,
  GuidedLessonError,
  guidedLessonService,
  type GuidedLesson,
  type GuidedLessonService,
} from "../../services/guidedLessons";
import { LoginDialog } from "../Auth/LoginDialog";
import { Icon } from "../Icon/Icon";

/* Keeps a guest's goal through the sign-in redirect. */
const DRAFT_KEY = "gitgud:guided-goal-draft:v1";

interface GuidedLessonPromptProps {
  /** Called with the validated puzzle; the screen decides where to open it. */
  onGenerated: (lesson: GuidedLesson) => void;
  /** Where sign-in returns to. */
  returnPath: string;
  service?: GuidedLessonService;
}

type Phase = { kind: "idle" } | { kind: "generating" } | { kind: "error"; message: string };

/** Figma AI prompt (node 45:159981): "What do you want to learn?" plus a lime send button. */
export function GuidedLessonPrompt({ onGenerated, returnPath, service = guidedLessonService }: GuidedLessonPromptProps) {
  const { status } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [goal, setGoal] = useState(readDraft);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [loginOpen, setLoginOpen] = useState(false);
  const generating = phase.kind === "generating";

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    if (status !== "authenticated") {
      writeDraft(trimmed);
      setLoginOpen(true);
      return;
    }

    setPhase({ kind: "generating" });
    try {
      const lesson = await service.generate({ goal: trimmed });
      writeDraft("");
      setPhase({ kind: "idle" });
      onGenerated(lesson);
    } catch (error) {
      const message =
        error instanceof GuidedLessonError ? error.message : "We couldn't build your puzzle. Please try again.";
      setPhase({ kind: "error", message });
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex gap-3">
        <label htmlFor="guided-goal" className="sr-only">
          What do you want to learn?
        </label>
        <input
          ref={inputRef}
          id="guided-goal"
          value={goal}
          onChange={(event) => {
            setGoal(event.target.value);
            if (phase.kind === "error") setPhase({ kind: "idle" });
          }}
          disabled={generating}
          maxLength={GUIDED_GOAL_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          placeholder="What do you want to learn?"
          aria-describedby="guided-goal-status"
          className="min-h-11 min-w-0 flex-1 rounded border border-lime-400 bg-green-900 p-3 font-secondary text-code text-grey-50 outline-none transition-colors duration-200 placeholder:text-grey-400 focus:border-lime-300 focus:outline focus:outline-1 focus:-outline-offset-2 focus:outline-lime-300 disabled:cursor-wait disabled:text-grey-400"
        />
        <button
          type="submit"
          disabled={generating}
          aria-label={generating ? "Building your puzzle" : "Build my puzzle"}
          className="grid min-h-11 w-11 shrink-0 place-items-center self-stretch rounded bg-lime-400 text-green-950 transition-colors duration-200 hover:bg-lime-300 active:bg-lime-500 disabled:cursor-wait"
        >
          <AnimatePresence mode="wait" initial={false}>
            {generating ? (
              <motion.span
                key="busy"
                className="flex gap-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    className="block size-1 rounded bg-current"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.12, ease: "easeInOut" }}
                  />
                ))}
              </motion.span>
            ) : (
              <motion.span
                key="send"
                className="flex"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={spring.snappy}
              >
                <Icon name="arrow_back_ios_new" size={20} className="rotate-180" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>

      <div id="guided-goal-status" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {phase.kind !== "idle" && (
            <motion.p
              key={phase.kind}
              className={`overflow-hidden text-xs ${phase.kind === "error" ? "text-red-200" : "text-grey-300"}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.snappy}
            >
              <span className="block pt-2">
                {phase.kind === "error" ? phase.message : "Building your puzzle…"}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath={returnPath} />
    </div>
  );
}

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(goal: string) {
  try {
    if (goal) sessionStorage.setItem(DRAFT_KEY, goal);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be blocked; the draft is only a convenience.
  }
}
