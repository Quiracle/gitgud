import { motion } from "motion/react";
import { useState } from "react";
import { spring } from "../../lib/motion";
import { Button } from "../Button/Button";
import { Icon } from "../Icon/Icon";
import { Dialog } from "./Dialog";

const STEPS = [
  "Each card is a commit. It shows the chicken at that point in history.",
  "Tags are branches. The lime outline is HEAD, where you are.",
  "Type Git commands in the terminal to change the history.",
  "Win when your branch's chicken matches the Goal card. Any order of commands works.",
  "Stuck? Take a hint, restart (your timer keeps going), or give up to see the solution.",
];

/** The rules of the game, shared by the How to play popup and the puzzle help. */
export function HowToPlaySteps({ animate = true }: { animate?: boolean }) {
  return (
    <ol className="flex flex-col gap-2 text-sm text-grey-300">
      {STEPS.map((step, index) => (
        <motion.li
          key={step}
          className="flex gap-2"
          initial={animate ? { opacity: 0, x: -8 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...spring.soft, delay: 0.1 + index * 0.06 }}
        >
          <span className="text-lime-400">{index + 1}.</span>
          <span>{step}</span>
        </motion.li>
      ))}
    </ol>
  );
}

interface HowToPlayLinkProps {
  onNavigate: (path: string) => void;
  /** Offers the Learn Basics course from the popup; omit where the course is already on screen. */
  learnHref?: string;
  /** Offers to replay the welcome tutorial from the popup. */
  onTutorial?: () => void;
}

/** "How to play" link that opens a quick explainer of the game. */
export function HowToPlayLink({ onNavigate, learnHref, onTutorial }: HowToPlayLinkProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex min-h-11 items-center gap-2 self-end text-sm text-grey-50"
      >
        <span className="underline decoration-from-font underline-offset-2">How to play</span>
        <motion.span whileHover={{ rotate: 20 }} transition={spring.snappy} className="flex">
          <Icon name="help" size={16} />
        </motion.span>
      </button>

      <Dialog size="wide" open={open} title="How to play" onClose={close}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-grey-50">
            Every day there's a new Git puzzle. Turn the starting repository into the goal by typing Git commands.
          </p>
          <HowToPlaySteps />
          <p className="text-xs text-grey-400">Your time and retries rank you on the daily leaderboard.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={close}>Got it</Button>
          {onTutorial && (
            <Button variant="outline" onClick={() => { close(); onTutorial(); }}>
              Watch the tutorial
            </Button>
          )}
          {learnHref && (
            <Button variant="tertiary" href={learnHref} onNavigate={(path) => { close(); onNavigate(path); }}>
              New to Git? Learn the basics
            </Button>
          )}
        </div>
      </Dialog>
    </>
  );
}
