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
import { InteractiveRebaseDialog } from "../components/RebaseDialog/InteractiveRebaseDialog";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePuzzleSession, type SubmissionState } from "../hooks/usePuzzleSession";
import { useVisualViewport } from "../hooks/useVisualViewport";
import { clearCanvasOrigin, peekCanvasOrigin } from "../lib/canvasTransition";
import { formatDuration } from "../lib/format";
import { spring } from "../lib/motion";
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
  resultAction = { label: "See leaderboard", icon: "crown", href: "/leaderboard" },
  intro,
}: SolveScreenProps) {
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
          aria-label={`Goals: ${goalsMet} of ${checks.length} done`}
          className="absolute right-6 top-6 flex flex-col items-center rounded border border-grey-300 bg-grey-50 p-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]"
          animate={solved ? { y: [0, -14, 0], rotate: [0, -4, 4, 0] } : {}}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <div className="flex items-center gap-1 self-start text-grey-950">
            <Icon name="flag_2" size={16} />
            <span className="text-paragraph leading-5">Goal</span>
          </div>
          <PixelChicken look={chickenLookFromState(puzzle.target.snapshot)} size={64} />
          <span className="mt-1 rounded-sm bg-green-950 px-1.5 font-secondary text-xs leading-5 text-lime-400">
            {goalsMet}/{checks.length} goals
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
            disabledPlaceholder={
              session.locked
                ? `Solved in ${formatDuration(session.finalElapsedMs ?? 0)}. Come back tomorrow!`
                : "Solved! Exit to play more."
            }
          />
        </div>
      </motion.div>

      {confetti && <Confetti key={confetti.key} x={confetti.x} y={confetti.y} />}

      {/* No close: a solved puzzle is finished, so the popup only leads onward. */}
      <Dialog open={panel === "result"} title={session.assisted ? "Solved with help" : "Congrats!"}>
        <div className="flex flex-col gap-1">
          <StatRow label="Retries:" value={session.restartCount} />
          <StatRow label="Time taken:" value={formatDuration(session.finalElapsedMs ?? session.elapsedMs())} large />
          {session.assisted && <StatRow label="Points:" value="0 (solution revealed)" />}
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
            {submissionMessage(session.submission.state, session.submission.error)}
          </motion.p>
        </AnimatePresence>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onNavigate(resultAction.href)}>
            <span>{resultAction.label}</span>
            <Icon name={resultAction.icon} size={20} className="ml-2" />
          </Button>
          <Button variant="tertiary" onClick={() => onNavigate("/")}>
            Back home
          </Button>
        </div>
      </Dialog>

      <Dialog open={panel === "restart"} title="Restart puzzle?" onClose={closePanel}>
        <p className="text-sm text-grey-300">
          The repository goes back to the start. Your timer keeps running and this counts as a retry.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={restart}>
            <Icon name="forward_media" size={20} className="mr-2" />
            Restart
          </Button>
          <Button variant="outline" onClick={closePanel}>
            Keep playing
          </Button>
        </div>
      </Dialog>

      <Dialog open={panel === "give-up"} title="Give up?" onClose={() => { session.resume(); closePanel(); }}>
        <p className="text-sm text-grey-300">
          Start over with the same timer, or reveal how to solve it. Revealing marks this puzzle as assisted and it
          earns 0 points.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={restart}>
            <Icon name="forward_media" size={20} className="mr-2" />
            Try again
          </Button>
          <Button variant="outline" onClick={() => { session.revealSolution(); setPanel("solution"); }}>
            Reveal solution
          </Button>
        </div>
      </Dialog>

      <Dialog size="wide" open={panel === "solution"} title="How to solve it" onClose={() => { session.resume(); closePanel(); }}>
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
        <p className="text-xs text-grey-400">Assisted run: you can still finish it, but it won't be ranked.</p>
        <Button onClick={restart}>Try again</Button>
      </Dialog>

      <Dialog open={panel === "hint"} title={hintTitle(session.hintsUsed, session.hintsTotal)} onClose={closePanel}>
        {session.hintsTotal === 0 ? (
          <p className="text-sm text-grey-300">This puzzle has no hints. Compare the goal with the HEAD card.</p>
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
            Show another hint
          </Button>
        ) : (
          <Button onClick={closePanel}>Back to puzzle</Button>
        )}
      </Dialog>

      {intro && (
        <Dialog size="wide" open={panel === "intro"} title={intro.title} onClose={closePanel}>
          {intro.body}
          <div className="flex flex-col gap-2">
            <Button onClick={closePanel}>
              <span>{session.commandCount > 0 || solved ? "Back to puzzle" : "Let's go"}</span>
              <Icon name="arrow_forward_ios" size={20} className="ml-2" />
            </Button>
            <Button variant="tertiary" onClick={() => setPanel("help")}>
              How to play
            </Button>
          </div>
        </Dialog>
      )}

      <Dialog size="wide" open={panel === "goals"} title="Goals" onClose={closePanel}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-grey-50">{puzzle.description}</p>
          <ul className="flex flex-col gap-2" aria-label="Goal checklist">
            {checks.map((check) => {
              const met = solved || check.met;
              return (
                <li key={check.id} className={`flex gap-2 ${met ? "text-lime-400" : "text-grey-300"}`}>
                  <span aria-hidden className="w-4 shrink-0 text-center">{met ? "✓" : "○"}</span>
                  <span>
                    {check.label}
                    <span className="sr-only">{met ? " (done)" : " (not done yet)"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-grey-400">
            The puzzle is solved when every goal is ticked. A matching chicken isn't enough while history goals are open.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={closePanel}>
            <span>{session.commandCount > 0 || solved ? "Back to puzzle" : "Let's go"}</span>
            <Icon name="arrow_forward_ios" size={20} className="ml-2" />
          </Button>
          <Button variant="tertiary" onClick={() => setPanel("help")}>
            How to play
          </Button>
        </div>
      </Dialog>

      <Dialog size="wide" open={panel === "help"} title="How to play" onClose={closePanel}>
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
            {puzzle.allowedCommands.map((command) => (
              <span key={command} className="rounded bg-green-900 px-2 py-1 font-secondary text-xs text-lime-400">
                git {command === "interactive-rebase" ? "rebase -i" : command}
              </span>
            ))}
          </div>
        </div>
        <Button onClick={closePanel}>Got it</Button>
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

function hintTitle(used: number, total: number) {
  if (total === 0) return "No hints";
  return `Hint ${Math.max(1, used)} of ${total}`;
}

function submissionMessage(state: SubmissionState, error?: string): string {
  switch (state) {
    case "guest":
      return "Saved on this device. Log in and this solve joins the leaderboard.";
    case "not-ranked":
      return "Progress saved on this device.";
    case "assisted":
      return "Solution revealed, so this run isn't ranked.";
    case "submitting":
      return "Sending your result to the leaderboard…";
    case "submitted":
      return "You're on today's leaderboard!";
    case "failed":
      return error ?? "Saved here, but the leaderboard couldn't be reached.";
  }
}
