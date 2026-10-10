import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { spring } from "../../lib/motion";
import { Button } from "../Button/Button";
import { CommitCard } from "../GitGraph/CommitTree";
import { Icon } from "../Icon/Icon";
import { chickenLookFromState, PixelChicken, type ChickenLook } from "../Illustration/PixelChicken";
import { Dialog } from "../Puzzle/Dialog";

const PLAIN = chickenLookFromState({});
const SCARF = chickenLookFromState({ scarf: true });
const COOL = chickenLookFromState({ scarf: true, sunglasses: true });
const HAT = chickenLookFromState({ scarf: true, hat: true });

/* Commit card body height (Figma "card branch"), so connectors meet it mid-height. */
const LINK = "mb-[42px] h-px w-5 shrink-0 self-end origin-left bg-grey-500";

interface Step {
  title: string;
  scene: () => ReactNode;
  text: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Welcome to gitgud!",
    scene: () => <HistoryScene />,
    text: (
      <>
        A new Git puzzle every day. This is a repository’s history: each card is a <Em>commit</Em> showing the
        chicken at that moment.
      </>
    ),
  },
  {
    title: "Branches and HEAD",
    scene: () => <BranchesScene />,
    text: (
      <>
        Tags like <Code>main</Code> are <Em>branches</Em>: names that point at a commit. The lime outline is{" "}
        <Em>HEAD</Em>, the commit you’re on.
      </>
    ),
  },
  {
    title: "Type Git commands",
    scene: () => <CommandScene />,
    text: (
      <>
        Change the history by typing commands in the terminal. Here <Code>git cherry-pick</Code> copied a hat from
        another branch onto <Code>main</Code> as a new commit.
      </>
    ),
  },
  {
    title: "Match the goal",
    scene: () => <GoalScene />,
    text: (
      <>
        You win when your branch’s chicken matches the <Em>Goal</Em>. Any order of commands works. Stuck? Take a
        hint or restart: your timer keeps going.
      </>
    ),
  },
];

const LAST = STEPS.length - 1;

interface WelcomeTutorialProps {
  open: boolean;
  /** Called on skip, close or either final choice. Keep it stable (useCallback). */
  onClose: () => void;
  onNavigate: (path: string) => void;
}

/** First-visit walkthrough: four animated steps, then the "New to Git?" choice. */
export function WelcomeTutorial({ open, onClose, onNavigate }: WelcomeTutorialProps) {
  const [[step, direction], setStep] = useState<[number, number]>([0, 1]);
  const go = (next: number) => setStep(([current]) => [Math.max(0, Math.min(LAST, next)), next > current ? 1 : -1]);

  // Every opening starts from the first step.
  useEffect(() => {
    if (open) setStep([0, 1]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setStep(([current]) => [Math.min(LAST, current + 1), 1]);
      if (event.key === "ArrowLeft") setStep(([current]) => [Math.max(0, current - 1), -1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { title, scene, text } = STEPS[step];
  const slide = {
    enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
    center: { opacity: 1, x: 0 },
    leave: (dir: number) => ({ opacity: 0, x: dir * -32, transition: { duration: 0.14 } }),
  };

  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded border border-grey-800">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slide}
              initial="enter"
              animate="center"
              exit="leave"
              transition={spring.soft}
            >
              {scene()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Every step's text sits in one grid cell so the popup keeps the tallest height. */}
        <div className="grid text-sm text-grey-300">
          {STEPS.map((candidate) => (
            <p key={candidate.title} aria-hidden className="invisible [grid-area:1/1]">
              {candidate.text}
            </p>
          ))}
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={step}
              className="[grid-area:1/1]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {text}
            </motion.p>
          </AnimatePresence>
        </div>

        <Progress step={step} />
      </div>

      <div className="flex flex-col gap-2">
        {step < LAST ? (
          <>
            <Button onClick={() => go(step + 1)}>Next</Button>
            {step === 0 ? (
              <Button variant="tertiary" onClick={onClose}>
                Skip tutorial
              </Button>
            ) : (
              <Button variant="tertiary" onClick={() => go(step - 1)}>
                Back
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="pb-2 text-paragraph leading-5 text-grey-50">New to Git?</p>
            <Button href="/course" onNavigate={(path) => { onClose(); onNavigate(path); }}>
              Yes, teach me the basics
            </Button>
            <Button variant="outline" onClick={onClose}>
              I know Git, let me play
            </Button>
            <Button variant="tertiary" onClick={() => go(step - 1)}>
              Back
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="sr-only">
        Step {step + 1} of {STEPS.length}
      </span>
      {STEPS.map((candidate, index) => (
        <motion.span
          key={candidate.title}
          aria-hidden
          className={`h-1.5 rounded transition-colors duration-300 ${index <= step ? "bg-lime-400" : "bg-grey-700"}`}
          initial={false}
          animate={{ width: index === step ? 20 : 6 }}
          transition={spring.snappy}
        />
      ))}
    </div>
  );
}

function Em({ children }: { children: ReactNode }) {
  return <span className="text-grey-50">{children}</span>;
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-green-900 px-1 font-secondary text-xs text-lime-400">{children}</code>;
}

/** A row of commit cards, tall enough for branch tags so nothing jumps when one appears. */
function Row({ children }: { children: ReactNode }) {
  return <div className="flex h-[102px] items-end justify-center">{children}</div>;
}

function Card({ id, look, branch, delay }: { id: string; look: ChickenLook; branch?: string; delay?: number }) {
  const card = (
    <CommitCard id={id} look={look} branches={branch ? [branch] : []} currentBranch="main" focused={branch === "main"} />
  );
  if (delay === undefined) return card;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.bouncy, delay }}>
      {card}
    </motion.div>
  );
}

function Link({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className={LINK}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.25, ease: "easeOut", delay }}
    />
  );
}

/** Becomes true once `ms` have passed, or straight away for reduced motion. */
function useBeat(ms: number): boolean {
  const reduce = useReducedMotion();
  const [done, setDone] = useState(Boolean(reduce));
  useEffect(() => {
    if (reduce) {
      setDone(true);
      return;
    }
    const timer = window.setTimeout(() => setDone(true), ms);
    return () => window.clearTimeout(timer);
  }, [ms, reduce]);
  return done;
}

/** Step 1: history builds up, one commit at a time. */
function HistoryScene() {
  return (
    <Row>
      <Card id="a1" look={PLAIN} delay={0.15} />
      <Link delay={0.4} />
      <Card id="a2" look={SCARF} delay={0.55} />
      <Link delay={0.8} />
      <Card id="a3" look={COOL} delay={0.95} />
    </Row>
  );
}

/** Step 2: the same history gains branch tags and HEAD. */
function BranchesScene() {
  const tagged = useBeat(450);
  return (
    <Row>
      <Card id="a1" look={PLAIN} />
      <span className={LINK} />
      <Card id="a2" look={SCARF} branch={tagged ? "scarf" : undefined} />
      <span className={LINK} />
      <Card id="a3" look={COOL} branch={tagged ? "main" : undefined} />
    </Row>
  );
}

const COMMAND = "git cherry-pick h7";
const TYPE_START = 500;
const KEYSTROKE = 55;

/** Step 3: a command is typed and a new commit lands on main. */
function CommandScene() {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? COMMAND.length : 0);
  const ran = useBeat(TYPE_START + COMMAND.length * KEYSTROKE + 400);

  useEffect(() => {
    if (reduce) return;
    const timers = Array.from(COMMAND, (_, index) =>
      window.setTimeout(() => setTyped(index + 1), TYPE_START + (index + 1) * KEYSTROKE),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduce]);

  return (
    <div className="flex w-[238px] flex-col gap-3">
      <div className="flex h-[102px] items-end">
        <Card id="a1" look={PLAIN} />
        <span className={LINK} />
        <Card id="a2" look={SCARF} branch={ran ? undefined : "main"} />
        {ran && (
          <>
            <Link />
            <Card id="g1" look={HAT} branch="main" delay={0.1} />
          </>
        )}
      </div>
      <motion.div
        className={`flex h-11 items-center rounded border bg-green-900 px-3 font-secondary text-code transition-colors duration-300 ${
          ran ? "border-lime-400" : "border-grey-500"
        }`}
        animate={ran ? { boxShadow: ["0 0 0 0 rgb(158 232 43 / 0.6)", "0 0 0 8px rgb(158 232 43 / 0)"] } : {}}
        transition={{ duration: 0.8 }}
      >
        <span className="truncate text-grey-50">{COMMAND.slice(0, typed)}</span>
        {!ran && (
          <motion.span
            aria-hidden
            className="ml-px h-4 w-2 shrink-0 bg-lime-400"
            animate={{ opacity: [1, 1, 0, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
          />
        )}
      </motion.div>
    </div>
  );
}

/** Step 4: the HEAD commit is compared with the goal and it's a match. */
function GoalScene() {
  const matched = useBeat(700);
  return (
    <Row>
      <Card id="g1" look={HAT} branch="main" />
      <div className="mb-[30px] flex w-14 shrink-0 items-center justify-center self-end">
        <AnimatePresence mode="wait" initial={false}>
          {matched ? (
            <motion.span
              key="match"
              className="flex size-6 items-center justify-center rounded bg-lime-400 text-green-950"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring.bouncy}
            >
              <Icon name="check" size={20} />
            </motion.span>
          ) : (
            <motion.span key="compare" className="text-xl text-grey-400" exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              =
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        className="flex flex-col gap-1 rounded border border-grey-300 bg-grey-50 p-2"
        animate={matched ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] } : {}}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
      >
        <div className="flex items-center gap-1 text-grey-950">
          <Icon name="flag_2" size={16} />
          <span className="text-paragraph leading-5">Goal</span>
        </div>
        <PixelChicken look={HAT} size={48} />
      </motion.div>
    </Row>
  );
}
