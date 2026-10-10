import { motion } from "motion/react";
import { useMemo } from "react";

const COLORS = ["#9ee82b", "#bdf462", "#fbdd31", "#ff4733", "#fdb874", "#fafafa"];

interface ConfettiProps {
  /** Burst origin in viewport pixels. */
  x: number;
  y: number;
  pieces?: number;
}

/** A one-shot burst of pixel squares that arc out and fall, like the chicken art. */
export function Confetti({ x, y, pieces = 44 }: ConfettiProps) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, index) => {
        const angle = (Math.PI * 2 * index) / pieces + Math.random() * 0.5;
        const speed = 90 + Math.random() * 160;
        const dx = Math.cos(angle) * speed;
        const rise = Math.sin(angle) * speed - 80;
        return {
          id: index,
          size: 4 + Math.round(Math.random() * 3) * 2,
          color: COLORS[index % COLORS.length],
          x: [0, dx * 0.7, dx],
          y: [0, rise, rise + 260 + Math.random() * 140],
          rotate: [0, (Math.random() - 0.5) * 540],
          duration: 1.1 + Math.random() * 0.6,
        };
      }),
    [pieces],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {bits.map((bit) => (
        <motion.span
          key={bit.id}
          className="absolute block"
          style={{ left: x, top: y, width: bit.size, height: bit.size, backgroundColor: bit.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: bit.x, y: bit.y, rotate: bit.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: bit.duration, ease: [0.2, 0.7, 0.4, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
