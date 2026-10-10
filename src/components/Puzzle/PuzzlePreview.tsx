import { motion } from "motion/react";
import { useRef, type ReactNode, type RefObject } from "react";
import { setCanvasOrigin } from "../../lib/canvasTransition";
import { spring } from "../../lib/motion";
import type { PublicPuzzleDefinition } from "../../puzzles";
import { DifficultyBadge } from "../Difficulty/DifficultyBadge";
import { CommitTree } from "../GitGraph/CommitTree";
import { Icon } from "../Icon/Icon";
import { chickenLookFromState, PixelChicken } from "../Illustration/PixelChicken";

/**
 * Remembers where a preview canvas is so the puzzle screen can grow out of it.
 * Call `open(path)` instead of navigating directly.
 */
export function useCanvasHandOff(onNavigate: (path: string) => void) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const treeScale = useRef(1);
  return {
    canvasRef,
    onScale: (scale: number) => {
      treeScale.current = scale;
    },
    open(path: string) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && canvasRef.current?.dataset.ready === "true") {
        setCanvasOrigin({
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          treeScale: treeScale.current,
        });
      }
      onNavigate(path);
    },
  };
}

interface PuzzlePreviewProps {
  canvasRef: RefObject<HTMLDivElement>;
  /** Omit while loading to show the skeleton. */
  puzzle?: PublicPuzzleDefinition;
  onScale: (scale: number) => void;
  onOpen: () => void;
  openLabel: string;
  showDifficulty?: boolean;
  /** Replaces the drawing, e.g. for an error message. */
  fallback?: ReactNode;
}

/** Figma preview canvas (Home node 24:33068, Learn node 39:120600). */
export function PuzzlePreview({ canvasRef, puzzle, onScale, onOpen, openLabel, showDifficulty = false, fallback }: PuzzlePreviewProps) {
  return (
    <div
      ref={canvasRef}
      data-ready={puzzle && !fallback ? "true" : "false"}
      className="relative aspect-square w-full overflow-hidden rounded bg-green-900"
    >
      {fallback ?? (!puzzle ? <PreviewSkeleton /> : (
        <>
          <button type="button" onClick={onOpen} aria-label={openLabel} className="absolute inset-0 cursor-pointer">
            <CommitTree repository={puzzle.initialRepository} padding={24} onScale={onScale} className="size-full" />
          </button>
          {showDifficulty && (
            <motion.div
              className="absolute left-2 top-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring.soft, delay: 0.3 }}
            >
              <DifficultyBadge difficulty={puzzle.difficulty} />
            </motion.div>
          )}
          <GoalCard puzzle={puzzle} />
        </>
      ))}
    </div>
  );
}

/** Figma goal card (node 24:33070). */
function GoalCard({ puzzle }: { puzzle: PublicPuzzleDefinition }) {
  return (
    <motion.div
      className="absolute right-2 top-2 flex flex-col rounded border border-grey-300 bg-grey-50 p-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]"
      initial={{ opacity: 0, y: -24, rotate: 8 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...spring.bouncy, delay: 0.45 }}
    >
      <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}>
        <div className="flex items-center gap-1 text-grey-950">
          <Icon name="flag_2" size={16} />
          <span className="text-paragraph leading-5">Goal</span>
        </div>
        <PixelChicken look={chickenLookFromState(puzzle.target.snapshot)} size={64} />
      </motion.div>
    </motion.div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10" aria-label="Loading puzzle">
      {[1, 2].map((row) => (
        <div key={row} className="flex gap-16">
          {Array.from({ length: row }, (_, index) => (
            <motion.div
              key={index}
              className="h-[85px] w-[66px] rounded border border-grey-700"
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: (row + index) * 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** "How to play ⓘ" link from the Figma heroes. */
export function HowToPlayLink({ href, onNavigate }: { href: string; onNavigate: (path: string) => void }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNavigate(href);
      }}
      className="group flex min-h-11 items-center gap-2 self-end text-sm text-grey-50"
    >
      <span className="underline decoration-from-font underline-offset-2">How to play</span>
      <motion.span whileHover={{ rotate: 20 }} transition={spring.snappy} className="flex">
        <Icon name="help" size={16} />
      </motion.span>
    </a>
  );
}
