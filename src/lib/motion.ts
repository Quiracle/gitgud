import type { Transition, Variants } from "motion/react";

/** Shared motion vocabulary so every screen moves with the same physics. */
export const spring = {
  /** Buttons, toggles, small state flips: quick with a little bounce. */
  snappy: { type: "spring", stiffness: 520, damping: 30, mass: 0.7 },
  /** Cards, sheets, panels entering. */
  soft: { type: "spring", stiffness: 260, damping: 26 },
  /** Celebrations and pop-ins: deliberately bouncy. */
  bouncy: { type: "spring", stiffness: 420, damping: 14, mass: 0.8 },
  /** Layout morphs (shared-element indicators). */
  layout: { type: "spring", stiffness: 480, damping: 38 },
} satisfies Record<string, Transition>;

/** Press feedback for anything tappable. */
export const tap = { scale: 0.96 } as const;

/** Parent that reveals children one after another. */
export const stagger = (step = 0.06, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: step, delayChildren: delay } },
});

/** Child of `stagger`: rises into place. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

/** Child of `stagger`: pops in from smaller. */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: spring.bouncy },
};
