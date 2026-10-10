import { motion } from "motion/react";
import { spring } from "../../lib/motion";

interface StreakTrailProps {
  /** Oldest first; the last entry is today. */
  days: boolean[];
  label: string;
}

const SEGMENT = 19;
const SQUARE = 12;

/** Figma streak row (node 24:33053): a commit-like trail of the last days. */
export function StreakTrail({ days, label }: StreakTrailProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex h-3 items-center" aria-label={label}>
        <motion.span
          className="block h-px border-t border-dashed border-lime-400"
          style={{ width: SEGMENT }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        {days.map((done, index) => (
          <span key={index} className="flex items-center">
            {index > 0 && (
              <motion.span
                className="block h-px bg-lime-400"
                style={{ width: SEGMENT, originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.18, ease: "easeOut", delay: 0.2 + index * 0.12 }}
              />
            )}
            <motion.span
              className={`block rounded border border-lime-400 ${done ? "bg-lime-400" : ""}`}
              style={{ width: SQUARE, height: SQUARE }}
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...spring.bouncy, delay: 0.25 + index * 0.12 }}
            />
          </span>
        ))}
      </div>
      <motion.p
        className="whitespace-nowrap text-xs text-grey-200"
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...spring.soft, delay: 0.25 + days.length * 0.12 }}
      >
        {label}
      </motion.p>
    </div>
  );
}
