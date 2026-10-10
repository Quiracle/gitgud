import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, type PointerEvent, type RefObject } from "react";
import { getSnapshot, type Repository } from "../../engine";
import { branchesAtCommit } from "../../engine/graph";
import { useElementSize } from "../../hooks/useElementSize";
import { spring } from "../../lib/motion";
import { chickenLookFromState, PixelChicken, type ChickenLook } from "../Illustration/PixelChicken";
import { layoutCommitTree } from "./treeLayout";

/* Figma "card branch" (node 24:64232): 66x85, or 66x102 with a branch tag. */
const CARD_W = 66;
const CARD_H = 85;
const TAG_H = 17;

interface CommitTreeProps {
  repository: Repository;
  /** Inner padding between the drawing and the container edge. */
  padding?: number;
  /** Outline the commit HEAD points at and show branch tags. */
  showRefs?: boolean;
  /** Draw nodes and connectors in sequence on mount. */
  animateIn?: boolean;
  /**
   * "fit" scales the drawing down to the container. "pan" keeps it at full size in a
   * scrollable canvas (touch, wheel, or mouse drag) that follows HEAD.
   */
  mode?: "fit" | "pan";
  /** Scale to grow from on mount, for a shared-element entrance. */
  introScale?: number;
  /** Reports the fitted scale so another screen can continue from it. */
  onScale?: (scale: number) => void;
  className?: string;
}

/**
 * Illustrated commit graph: each card shows the repository snapshot at that commit.
 * The drawing keeps Figma proportions and scales down to fit its container.
 */
export function CommitTree({
  repository,
  padding = 16,
  showRefs = true,
  animateIn = true,
  mode = "fit",
  introScale,
  onScale,
  className = "",
}: CommitTreeProps) {
  const [ref, box] = useElementSize<HTMLDivElement>();
  const layout = useMemo(() => layoutCommitTree(repository), [repository]);
  const looks = useMemo(
    () => Object.fromEntries(Object.keys(repository.commits).map((id) => [id, chickenLookFromState(getSnapshot(repository, id))])),
    [repository],
  );

  const tagsOf = (id: string) => (showRefs ? branchesAtCommit(repository, id) : []);
  // Two-column trees use the airy Figma spacing; wider trees tighten up.
  const colStep = layout.columns <= 2 ? 130 : CARD_W + 16;
  const rowStep = (layout.rows <= 2 ? 150 : CARD_H + 32) + (showRefs ? TAG_H : 0);
  const minCol = Math.min(...layout.nodes.map((node) => node.col));
  const width = (Math.max(...layout.nodes.map((node) => node.col)) - minCol) * colStep + CARD_W;
  const height = (layout.rows - 1) * rowStep + CARD_H + (showRefs ? TAG_H : 0);
  const pan = mode === "pan";
  const scale = !box.width
    ? 0
    : pan
      ? 1
      : Math.min(1, (box.width - padding * 2) / width, (box.height - padding * 2) / height);
  // In pan mode the scroll area is at least the viewport, with the drawing centred in it.
  const areaW = pan ? Math.max(box.width, width + padding * 2) : box.width;
  const areaH = pan ? Math.max(box.height, height + padding * 2) : box.height;

  useEffect(() => {
    if (scale > 0) onScale?.(scale);
  }, [scale, onScale]);

  const position = new Map(
    layout.nodes.map((node) => {
      const x = (node.col - minCol) * colStep;
      const y = node.row * rowStep;
      return [node.id, { x, y, row: node.row, h: CARD_H + (tagsOf(node.id).length ? TAG_H : 0) }];
    }),
  );
  const delayFor = (row: number, x: number) => (animateIn ? row * 0.14 + x / 2000 : 0);

  // Keep HEAD in view whenever it moves.
  const head = position.get(repository.head);
  const headX = head ? (areaW - width) / 2 + head.x + CARD_W / 2 : 0;
  const headY = head ? (areaH - height) / 2 + head.y + head.h / 2 : 0;
  const followed = useRef(false);
  useEffect(() => {
    const element = ref.current;
    if (!pan || !element || !box.width || !head) return;
    element.scrollTo({
      left: headX - box.width / 2,
      top: headY - box.height / 2,
      behavior: followed.current ? "smooth" : "instant",
    });
    followed.current = true;
  }, [pan, headX, headY, box.width, box.height, head, ref]);

  const drag = usePointerPan(ref);

  return (
    <div
      ref={ref}
      className={`relative ${pan ? "no-scrollbar cursor-grab overflow-auto overscroll-contain active:cursor-grabbing" : "overflow-hidden"} ${className}`}
      {...(pan ? drag : {})}
    >
      {scale > 0 && (
        <div className="relative" style={{ width: areaW, height: areaH }}>
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ width, height, x: "-50%", y: "-50%" }}
          initial={introScale ? { scale: introScale } : false}
          animate={{ scale }}
          transition={spring.soft}
        >
          <svg className="absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
            {layout.edges.map((edge) => {
              const from = position.get(edge.from)!;
              const to = position.get(edge.to)!;
              return (
                <motion.path
                  key={`${edge.from}-${edge.to}`}
                  fill="none"
                  stroke="rgb(var(--colors-grey-500))"
                  strokeWidth={1}
                  strokeDasharray={edge.secondary ? "4 3" : undefined}
                  initial={animateIn ? { pathLength: 0, opacity: 0, d: connector(from, to) } : false}
                  animate={{ pathLength: 1, opacity: 1, d: connector(from, to) }}
                  transition={{ duration: 0.45, ease: "easeInOut", delay: delayFor(from.row, from.x) + 0.12 }}
                />
              );
            })}
          </svg>
          <AnimatePresence initial={animateIn}>
            {layout.nodes.map((node) => {
              const at = position.get(node.id)!;
              return (
                <motion.div
                  key={node.id}
                  className="absolute"
                  initial={{ opacity: 0, scale: 0.5, y: -12, left: at.x, top: at.y }}
                  animate={{ opacity: 1, scale: 1, y: 0, left: at.x, top: at.y }}
                  exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
                  transition={{ ...spring.bouncy, delay: delayFor(at.row, at.x) }}
                >
                  <CommitCard
                    id={node.id}
                    look={looks[node.id]}
                    branches={tagsOf(node.id)}
                    currentBranch={repository.currentBranch}
                    focused={showRefs && node.id === repository.head}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
        </div>
      )}
    </div>
  );
}

/** Mouse drag-to-pan for desktop; touch and trackpads already scroll natively. */
function usePointerPan(ref: RefObject<HTMLDivElement>) {
  const start = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.pointerType !== "mouse" || !ref.current) return;
      start.current = { x: event.clientX, y: event.clientY, left: ref.current.scrollLeft, top: ref.current.scrollTop };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!start.current || !ref.current) return;
      ref.current.scrollLeft = start.current.left - (event.clientX - start.current.x);
      ref.current.scrollTop = start.current.top - (event.clientY - start.current.y);
    },
    onPointerUp() {
      start.current = null;
    },
  };
}

interface CommitCardProps {
  id: string;
  look: ChickenLook;
  branches: string[];
  currentBranch: string;
  focused: boolean;
}

/** One Figma "card branch" variant: optional branch tag, focus outline and dot for HEAD. */
function CommitCard({ id, look, branches, currentBranch, focused }: CommitCardProps) {
  const ordered = [...branches].sort((a, b) => Number(b === currentBranch) - Number(a === currentBranch));
  const onCurrent = ordered[0] === currentBranch;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded border bg-green-900 transition-colors duration-300 ${
        focused ? "border-lime-400" : "border-grey-500"
      }`}
      style={{ width: CARD_W }}
    >
      <AnimatePresence initial={false}>
        {ordered.length > 0 && (
          <motion.div
            key="tag"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: TAG_H, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.snappy}
            className={`flex shrink-0 items-center px-1 transition-colors duration-300 ${onCurrent ? "bg-grey-50" : "bg-grey-300"}`}
            title={ordered.join(", ")}
          >
            <span className="truncate text-2xs leading-[13px] text-green-950">{ordered.join(", ")}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex flex-col gap-1 p-2">
        <AnimatePresence>
          {focused && (
            <motion.span
              key="head"
              className="absolute right-0.5 top-0.5 size-1 rounded bg-lime-400"
              initial={{ scale: 0 }}
              animate={{ scale: [1, 1.8, 1] }}
              exit={{ scale: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
        <PixelChicken look={look} size={48} className="rounded" />
        <span className="truncate text-xs leading-[15px] text-grey-50">{id}</span>
      </div>
    </div>
  );
}

/** Figma connectors leave the parent's side at mid-height, then drop to the child. */
function connector(from: { x: number; y: number; h: number }, to: { x: number; y: number }): string {
  const fromCenter = from.x + CARD_W / 2;
  const toCenter = to.x + CARD_W / 2;
  if (Math.abs(fromCenter - toCenter) < 1) return `M${fromCenter} ${from.y + from.h}V${to.y}`;
  const side = toCenter < fromCenter ? from.x : from.x + CARD_W;
  return `M${side} ${from.y + from.h / 2}H${toCenter}V${to.y}`;
}
