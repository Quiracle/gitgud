import { motion } from "motion/react";
import type { PuzzleDifficulty } from "../../puzzles/types";
import { useI18n } from "../../i18n/I18nProvider";
import { spring } from "../../lib/motion";

const LEVEL: Record<PuzzleDifficulty, number> = { easy: 1, medium: 2, hard: 3 };
const BAR_HEIGHTS = [6, 9, 13];

/** Figma "difficulty" badge (node 24:37157) with the updated bars (node 24:9475): 4px bars, 1.2px stroke, 1px corners, filled up to the level. */
export function DifficultyBadge({ difficulty, className = "" }: { difficulty: PuzzleDifficulty; className?: string }) {
  const { t } = useI18n();
  const level = LEVEL[difficulty];
  return (
    <span className={`inline-flex items-center gap-2 rounded bg-grey-50 px-1 py-0.5 ${className}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            className="relative w-1 overflow-hidden rounded-[1px] border-[1.2px] border-green-950"
            style={{ height }}
          >
            {index < level && (
              <motion.span
                className="absolute inset-0 origin-bottom bg-green-950"
                initial={{ scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true }}
                transition={{ ...spring.snappy, delay: 0.15 + index * 0.08 }}
              />
            )}
          </span>
        ))}
      </span>
      <span className="text-xs leading-[15px] text-green-950">{t(`difficulty.${difficulty}`)}</span>
    </span>
  );
}
