import { animate, AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../components/Button/Button";
import { CommitTree } from "../components/GitGraph/CommitTree";
import { Icon, type IconName } from "../components/Icon/Icon";
import { chickenLookFromState, PixelChicken } from "../components/Illustration/PixelChicken";
import { ActionBar } from "../components/Puzzle/ActionBar";
import { CommandPanel } from "../components/Puzzle/CommandPanel";
import { Confetti } from "../components/Puzzle/Confetti";
import { Dialog, StatRow } from "../components/Puzzle/Dialog";
import { HowToPlaySteps } from "../components/Puzzle/HowToPlay";
import { ShareButton, useResultShare } from "../components/Share/ResultShare";
import { InteractiveRebaseDialog } from "../components/RebaseDialog/InteractiveRebaseDialog";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePuzzleSession, type SubmissionState } from "../hooks/usePuzzleSession";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { clearCanvasOrigin, peekCanvasOrigin } from "../lib/canvasTransition";
import { formatDuration } from "../lib/format";
import { spring } from "../lib/motion";
import { SUPPORTED_ACTION_TYPES } from "../engine";
import { goalLabel } from "../i18n/goals";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translate";
import type { PublicPuzzleDefinition } from "../puzzles";

interface SolveScreenProps {
  puzzle: PublicPuzzleDefinition;
  exitHref?: string;
  onNavigate: (path: string) => void;
  /** Main button in the result popup; defaults to the daily leaderboard. */
  resultAction?: { label: string; icon: IconName; href: string };
  /** Lesson explainer: opens on a fresh run when `autoOpen`, and from the help button. */
  intro?: { title: string; body: ReactNode; autoOpen: boolean };
}

type Panel = "none" | "intro" | "goals" | "help" | "hint" | "give-up" | "solution" | "result" | "restart";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Figma "daily puzzle" frame (node 24:44279); desktop docks the terminal to the right. */
export function SolveScreen({
  puzzle,
  exitHref = "/",
  onNavigate,
  resultAction,
  intro,
}: SolveScreenProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const action = resultAction ?? { label: t("solve.seeLeaderboard"), icon: "crown" as const, href: "/leaderboard" };
  const session = usePuzzleSession(puzzle);
  const desktop = useMediaQuery("(min-width: 1024px)");
  // Tablets and narrow desktop windows: terminal stays at the bottom but shows history.
  const roomy = useMediaQuery("(min-width: 640px)");
  const docked = desktop || roomy;
  const viewport = useVisualViewport();
  useLayoutEffect(() => {
    document.documentElement.classList.add("dark-backdrop");
    return () => document.documentElement.classList.remove("dark-backdrop");
  }, []);
  const [origin] = useState(peekCanvasOrigin);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [confetti, setConfetti] = useState<{ x: number; y: number; key: number } | null>(null);

  const canvas = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLDivElement>(null);
  const goal = useRef<HTMLButtonElement>(null);
  const solved = session.status === "completed";
  const checks = session.validation.checks;
  const goalsMet = solved ? checks.length : checks.filter((check) => check.met).length;
  const sharing = useResultShare(
    puzzle,
    solved
      ? { elapsedMs: session.finalElapsedMs ?? 0, restartCount: session.restartCount, assisted: session.assisted }
      : null,
  );

  // Grow the canvas out of the Home preview: clip from the old rectangle to the full
  // canvas while the tree slides into place, then the controls rise in.
  useLayoutEffect(() => {
    clearCanvasOrigin();
    const element = canvas.current;
    if (!origin || !element) return;
    const c = element.getBoundingClientRect();
    const o = origin.rect;
    const from = `inset(${o.top - c.top}px ${c.right - (o.left + o.width)}px ${c.bottom - (o.top + o.height)}px ${o.left - c.left}px round 2px)`;
    const controls = [
      animate(element, { clipPath: [from, "inset(0px 0px 0px 0px round 0px)"] }, { duration: 0.65, ease: EASE_OUT }),
    ];
    if (tree.current) {
      const dx = o.left + o.width / 2 - (c.left + c.width / 2);
      const dy = o.top + o.height / 2 - (c.top + c.height / 2);
      controls.push(animate(tree.current, { x: [dx, 0], y: [dy, 0] }, { duration: 0.65, ease: EASE_OUT }));
    }
    if (goal.current) {
      const g = goal.current.getBoundingClientRect();
      // On Home the goal card sits 8px inside the preview's top-right corner.
      const gx = o.left + o.width - 8 - g.right;
      const gy = o.top + 8 - g.top;
      controls.push(animate(goal.current, { x: [gx, 0], y: [gy, 0] }, { duration: 0.65, ease: EASE_OUT }));
    }
    return () => controls.forEach((control) => control.stop());
  }, [origin]);

  // Celebrate, then show the result. Reopening a solved daily skips straight to the board.
  useEffect(() => {
    if (!solved || session.solvedOnArrival) return;
    const g = goal.current?.getBoundingClientRect();
    setConfetti({ x: g ? g.left + g.width / 2 : window.innerWidth / 2, y: g ? g.top + g.height / 2 : 120, key: Date.now() });
    // Let the final command's result land on the graph before the popup covers it.
    const open = window.setTimeout(() => setPanel("result"), 2200);
    const clear = window.setTimeout(() => setConfetti(null), 2400);
    return () => {
      window.clearTimeout(open);
      window.clearTimeout(clear);
    };
  }, [solved]);

  const chromeDelay = origin ? 0.42 : 0.15;
  const closePanel = () => setPanel("none");
  const openHelp = () => setPanel(intro ? "intro" : "help");

  // Explain the lesson (or list the goals) once the canvas has settled, unless the run is already under way.
  useEffect(() => {
    const first: Panel | undefined = intro ? (intro.autoOpen ? "intro" : undefined) : "goals";
    if (!first || solved || session.commandCount > 0) return;
    const timer = window.setTimeout(() => setPanel((current) => (current === "none" ? first : current)), origin ? 750 : 400);
    return () => window.clearTimeout(timer);
    // Only on arrival: later commands or restarts must not reopen it.
  }, []);

  function openHint() {
    if (session.hintsUsed === 0) session.takeHint();
    setPanel("hint");
  }

  function openGiveUp() {
    session.giveUp();
    setPanel("give-up");
  }

  // Confirm only when the run has progress worth keeping.
  function askRestart() {
    if (session.commandCount === 0) restart();
    else setPanel("restart");
  }

  function restart() {
    session.restart();
    setExpanded(false);
    closePanel();
  }

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col overflow-hidden bg-green-950 lg:grid lg:grid-cols-[minmax(0,1fr)_400px]"
      style={{ height: viewport.height, transform: `translateY(${viewport.offsetTop}px)` }}
    >
      <motion.div
        ref={canvas}
        className="relative min-h-0 flex-1 overflow-hidden bg-green-900 lg:h-full"
        initial={origin ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={spring.soft}
      >
        <div ref={tree} className="absolute inset-0">
          <CommitTree
            repository={session.repository}
            mode="pan"
            introScale={origin?.treeScale}
            animateIn={!origin}
            className="size-full"
          />
        </div>
        <motion.button
          ref={goal}
          type="button"
          onClick={() => setPanel("goals")}
          aria-label={t("solve.goalsAria", { met: goalsMet, total: checks.length })}
          className="absolute right-6 top-6 flex flex-col items-center rounded border border-grey-300 bg-grey-50 p-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]"
          animate={solved ? { y: [0, -14, 0], rotate: [0, -4, 4, 0] } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="flex items-center gap-1 self-start text-grey-950">
            <Icon name="flag_2" size={16} />
            <span className="text-paragraph leading-5">{t("puzzle.goal")}</span>
          </div>
          <PixelChicken look={chickenLookFromState(puzzle.target.snapshot)} size={64} />
          <span className="mt-1 rounded-sm bg-green-950 px-1.5 font-secondary text-xs leading-5 text-lime-400">
            {t("solve.goalsCount", { met: goalsMet, count: checks.length })}
          </span>
        </motion.button>
      </motion.div>

      <motion.div
        className="relative flex flex-col sm:border-t sm:border-grey-800 lg:h-full lg:min-h-0 lg:border-l lg:border-t-0"
        initial={{ opacity: 0, y: 32 }}
        animate={{
          opacity: 1,
          y: 0,
          // Phones: the terminal grows over the canvas to show the full history.
          // Wider screens below desktop give it a fixed, generous share of the height.
          ...(desktop
            ? {}
            : roomy
              ? { height: Math.round(Math.min(Math.max(viewport.height * 0.42, 260), 480)) }
              : { height: expanded ? viewport.height : "auto" }),
        }}
        transition={{ ...spring.soft, delay: chromeDelay, height: spring.soft }}
      >
        <AnimatePresence initial={false}>
          {(docked || !expanded) && (
            <motion.div
              key="actions"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.snappy}
              className="overflow-hidden"
            >
              <ActionBar
                onExit={() => onNavigate(exitHref)}
                onRestart={askRestart}
                onHelp={openHelp}
                onHint={openHint}
                onGiveUp={openGiveUp}
                giveUpDisabled={solved}
                restartDisabled={session.locked}
                hintDisabled={session.locked}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className={docked || expanded ? "min-h-0 flex-1" : ""}>
          <CommandPanel
            entries={session.entries}
            onCommand={session.runCommand}
            expanded={expanded}
            docked={docked}
            onToggle={() => setExpanded((value) => !value)}
            onHelp={openHelp}
            disabled={solved}
            trailing={sharing.available ? <ShareButton onClick={sharing.share} className="self-stretch" /> : undefined}
            disabledPlaceholder={
              session.locked
                ? t("solve.lockedPlaceholder", { time: formatDuration(session.finalElapsedMs ?? 0) })
                : t("solve.solvedPlaceholder")
            }
          />
        </div>
      </motion.div>

      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} />}

      {/* No close: a solved puzzle is finished, so the popup only leads onward. */}
      <Dialog open={panel === "result" && !sharing.open} title={session.assisted ? t("result.assistedTitle") : t("result.title")}>
        <div className="flex flex-col gap-1">
          <StatRow label={t("result.retries")} value={i18n.formatNumber(session.restartCount)} />
          <StatRow label={t("result.time")} value={formatDuration(session.finalElapsedMs ?? session.elapsedMs())} large />
          {session.assisted && <StatRow label={t("result.points")} value={t("result.pointsAssisted")} />}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={session.submission.state}
            className={`text-xs ${session.submission.state === "failed" ? "text-red-400" : "text-grey-400"}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            aria-live="polite"
          >
            {t(SUBMISSION_MESSAGES[session.submission.state])}
          </motion.p>
        </AnimatePresence>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onNavigate(action.href)}>
            <span>{action.label}</span>
            <Icon name={action.icon} size={20} className="ml-2" />
          </Button>
          {sharing.available && (
            <Button variant="outline" onClick={sharing.share}>
              <Icon name="share" size={20} className="mr-2" />
              {t("result.share")}
            </Button>
          )}
          <Button variant="tertiary" onClick={() => onNavigate("/")}>
            {t("common.backHome")}
          </Button>
        </div>
      </Dialog>

      {sharing.dialog}

      <Dialog open={panel === "restart"} title={t("restart.title")} onClose={closePanel}>
        <p className="text-sm text-grey-300">{t("restart.body")}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={restart}>
            <Icon name="forward_media" size={20} className="mr-2" />
            {t("actions.restart")}
          </Button>
          <Button variant="outline" onClick={closePanel}>
            {t("restart.keepPlaying")}
          </Button>
        </div>
      </Dialog>

      <Dialog open={panel === "give-up"} title={t("giveUp.title")} onClose={() => { session.resume(); closePanel(); }}>
        <p className="text-sm text-grey-300">{t("giveUp.body")}</p>
        <div className="flex flex-col gap-2">
          <Button onClick={restart}>
            <Icon name="forward_media" size={20} className="mr-2" />
            {t("common.tryAgain")}
          </Button>
          <Button variant="outline" onClick={() => { session.revealSolution(); setPanel("solution"); }}>
            {t("giveUp.reveal")}
          </Button>
        </div>
      </Dialog>

      <Dialog size="wide" open={panel === "solution"} title={t("solution.title")} onClose={() => { session.resume(); closePanel(); }}>
        <ol className="flex flex-col gap-2 text-sm text-grey-50">
          {puzzle.hints.map((hint, index) => (
            <motion.li
              key={index}
              className="flex gap-2"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring.soft, delay: 0.1 + index * 0.08 }}
            >
              <span className="text-lime-400">{index + 1}.</span>
              <span>{hint}</span>
            </motion.li>
          ))}
        </ol>
        <p className="text-xs text-grey-400">{t("solution.assistedNote")}</p>
        <Button onClick={restart}>{t("common.tryAgain")}</Button>
      </Dialog>

      <Dialog open={panel === "hint"} title={session.hintsTotal === 0 ? t("hint.none") : t("hint.title", { number: Math.max(1, session.hintsUsed), total: session.hintsTotal })} onClose={closePanel}>
        {session.hintsTotal === 0 ? (
          <p className="text-sm text-grey-300">{t("hint.noneBody")}</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm text-grey-50">
            <AnimatePresence initial={false}>
              {puzzle.hints.slice(0, session.hintsUsed).map((hint, index) => (
                <motion.li
                  key={index}
                  className="flex gap-2"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={spring.soft}
                >
                  <Icon name="lightbulb_2" size={16} className="mt-0.5 text-lime-400" />
                  <span>{hint}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
        {session.hintsUsed < session.hintsTotal ? (
          <Button variant="outline" onClick={() => session.takeHint()}>
            {t("hint.another")}
          </Button>
        ) : (
          <Button onClick={closePanel}>{t("common.backToPuzzle")}</Button>
        )}
      </Dialog>

      {intro && (
        <Dialog size="wide" open={panel === "intro"} title={intro.title} onClose={closePanel}>
          {intro.body}
          <div className="flex flex-col gap-2">
            <Button onClick={closePanel}>
              <span>{session.commandCount > 0 || solved ? t("common.backToPuzzle") : t("common.letsGo")}</span>
              <Icon name="arrow_forward_ios" size={20} className="ml-2" />
            </Button>
            <Button variant="tertiary" onClick={() => setPanel("help")}>
              {t("howToPlay.title")}
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog size="wide" open={panel === "goals"} title={t("goals.title")} onClose={closePanel}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-grey-50">{puzzle.description}</p>
          <ul className="flex flex-col gap-2" aria-label={t("goals.checklist")}>
            {checks.map((check) => {
              const met = solved || check.met;
              return (
                <li key={check.id} className={`flex gap-2 ${met ? "text-lime-400" : "text-grey-300"}`}>
                  <span aria-hidden className="w-4 shrink-0 text-center">{met ? "✓" : "○"}</span>
                  <span>
                    {goalLabel(check, i18n)}
                    <span className="sr-only"> {met ? t("goals.done") : t("goals.notDone")}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-grey-400">{t("goals.note")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={closePanel}>
            <span>{session.commandCount > 0 || solved ? t("common.backToPuzzle") : t("common.letsGo")}</span>
            <Icon name="arrow_forward_ios" size={20} className="ml-2" />
          </Button>
          <Button variant="tertiary" onClick={() => setPanel("help")}>
            {t("howToPlay.title")}
          </Button>
        </div>
      </Dialog>

      <Dialog size="wide" open={panel === "help"} title={t("howToPlay.title")} onClose={closePanel}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-grey-50">{puzzle.description}</p>
          {puzzle.objectives && puzzle.objectives.length > 0 && (
            <ul className="flex flex-col gap-1 text-grey-300">
              {puzzle.objectives.map((objective) => (
                <li key={objective} className="flex gap-2">
                  <span className="text-lime-400">▸</span>
                  {objective}
                </li>
              ))}
            </ul>
          )}
          <HowToPlaySteps />
          <div className="flex flex-wrap gap-1">
            {SUPPORTED_ACTION_TYPES.map((command) => (
              <span key={command} className="rounded bg-green-900 px-2 py-1 font-secondary text-xs text-lime-400">
                git {command === "interactive-rebase" ? "rebase -i" : command}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={closePanel}>{t("common.gotIt")}</Button>
      </Dialog>

      <InteractiveRebaseDialog
        pending={session.pendingRebase}
        branch={session.repository.currentBranch}
        onCancel={session.cancelRebase}
        onConfirm={session.confirmRebase}
      />
    </div>
  );
}

const SUBMISSION_MESSAGES: Record<SubmissionState, TranslationKey> = {
  guest: "submission.guest",
  "not-ranked": "submission.notRanked",
  assisted: "submission.assisted",
  submitting: "submission.submitting",
  submitted: "submission.submitted",
  failed: "submission.failed",
};
