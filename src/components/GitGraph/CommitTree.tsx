import { motion } from "motion/react";
import { useMemo } from "react";
import { getSnapshot, type Repository } from "../../engine";
import { useElementSize } from "../../hooks/useElementSize";
import { spring } from "../../lib/motion";
import { chickenLookFromState, PixelChicken } from "../Illustration/PixelChicken";
import { layoutCommitTree } from "./treeLayout";

/* Figma commit card (node 24:33654): 66x85, 8px padding, 48px illustration, xs label. */
const CARD_W = 66;
const CARD_H = 85;

interface CommitTreeProps {
  repository: Repository;
  /** Inner padding between the drawing and the container edge. */
  padding?: number;
  /** Mark the commit HEAD points at. */
  showHead?: boolean;
  /** Draw nodes and connectors in sequence on mount. */
  animateIn?: boolean;
  className?: string;
}

/**
 * Illustrated commit graph: each card shows the repository snapshot at that commit.
 * The drawing keeps Figma proportions and scales down to fit its container.
 */
export function CommitTree({ repository, padding = 16, showHead = false, animateIn = true, className = "" }: CommitTreeProps) {
  const [ref, box] = useElementSize<HTMLDivElement>();
  const layout = useMemo(() => layoutCommitTree(repository), [repository]);
  const looks = useMemo(
    () => Object.fromEntries(Object.keys(repository.commits).map((id) => [id, chickenLookFromState(getSnapshot(repository, id))])),
    [repository],
  );

  // Two-column trees use the airy Figma spacing; wider trees tighten up.
  const colStep = layout.columns <= 2 ? 130 : CARD_W + 16;
  const rowStep = layout.rows <= 2 ? 150 : CARD_H + 32;
  const minCol = Math.min(...layout.nodes.map((node) => node.col));
  const width = (Math.max(...layout.nodes.map((node) => node.col)) - minCol) * colStep + CARD_W;
  const height = (layout.rows - 1) * rowStep + CARD_H;
  const scale = box.width
    ? Math.min(1, (box.width - padding * 2) / width, (box.height - padding * 2) / height)
    : 0;

  const position = new Map(
    layout.nodes.map((node) => [node.id, { x: (node.col - minCol) * colStep, y: node.row * rowStep, row: node.row }]),
  );
  const delayFor = (row: number, x: number) => (animateIn ? row * 0.14 + x / 2000 : 0);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {scale > 0 && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <svg className="absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
            {layout.edges.map((edge) => {
              const from = position.get(edge.from)!;
              const to = position.get(edge.to)!;
              return (
                <motion.path
                  key={`${edge.from}-${edge.to}`}
                  d={connector(from, to)}
                  fill="none"
                  stroke="rgb(var(--colors-grey-500))"
                  strokeWidth={1}
                  strokeDasharray={edge.secondary ? "4 3" : undefined}
                  initial={animateIn ? { pathLength: 0, opacity: 0 } : false}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.45, ease: "easeInOut", delay: delayFor(from.row, from.x) + 0.12 }}
                />
              );
            })}
          </svg>
          {layout.nodes.map((node) => {
            const at = position.get(node.id)!;
            const isHead = showHead && node.id === repository.head;
            return (
              <motion.div
                key={node.id}
                className={`absolute flex flex-col gap-1 rounded border p-2 ${isHead ? "border-lime-400" : "border-grey-500"}`}
                style={{ left: at.x, top: at.y, width: CARD_W, height: CARD_H }}
                initial={animateIn ? { opacity: 0, scale: 0.5, y: -12 } : false}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ ...spring.bouncy, delay: delayFor(at.row, at.x) }}
              >
                {isHead && (
                  <motion.span
                    className="absolute -right-[3px] -top-[3px] size-1.5 rounded-full bg-lime-400"
                    animate={{ scale: [1, 1.6, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                <PixelChicken look={looks[node.id]} size={48} className="rounded" />
                <span className="truncate text-xs leading-none text-grey-50">{node.id}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Figma connectors leave the parent's side at mid-height, then drop to the child. */
function connector(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const fromCenter = from.x + CARD_W / 2;
  const toCenter = to.x + CARD_W / 2;
  if (Math.abs(fromCenter - toCenter) < 1) return `M${fromCenter} ${from.y + CARD_H}V${to.y}`;
  const side = toCenter < fromCenter ? from.x : from.x + CARD_W;
  return `M${side} ${from.y + CARD_H / 2}H${toCenter}V${to.y}`;
}
