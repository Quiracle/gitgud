import { animate, AnimatePresence, motion, useMotionValue, type MotionValue } from "motion/react";
import { useEffect, useMemo, useRef, type PointerEvent, type ReactNode, type RefObject } from "react";
import {
  getSnapshot,
  pickBranchReference,
  type CommandReferenceKind,
  type Repository,
} from "../../engine";
import { branchesAtCommit } from "../../engine/graph";
import { useElementSize } from "../../hooks/useElementSize";
import { useI18n } from "../../i18n/I18nProvider";
import { spring } from "../../lib/motion";
import { Icon, type IconName } from "../Icon/Icon";
import { chickenLookFromState, PixelChicken, type ChickenLook } from "../Illustration/PixelChicken";
import { centerOn, clampPan, zoomAt, type Camera, type Size } from "./camera";
import { branchColours, branchLanes, layoutCommitTree } from "./treeLayout";

/* Figma "card branch" (node 24:64232): 66x85, or 66x102 with a branch tag. */
const CARD_W = 66;
const CARD_H = 85;
const TAG_H = 17;
/** Connector arrowhead: half-width and length. */
const ARROW_W = 4;
const ARROW_L = 6;
/** Commits no branch reaches keep the neutral card colour. */
const UNOWNED = "rgb(var(--colors-grey-500))";
/* Figma "HEAD" (node 89:161752) plus the pointed end the auto layout can't draw. */
const HEAD_TIP = 10;
const HEAD_GAP = 4;
/** Room the HEAD pointer takes beside a card: gap, tip and the "HEAD" label. */
const HEAD_EXTENT = 50;

interface CommitTreeProps {
  repository: Repository;
  /** Inner padding between the drawing and the container edge (fit mode). */
  padding?: number;
  /** Outline the commit HEAD points at and show branch tags. */
  showRefs?: boolean;
  /** Draw nodes and connectors in sequence on mount. */
  animateIn?: boolean;
  /**
   * "fit" scales the drawing down to the container. "pan" is a free canvas: drag to
   * move, pinch / ctrl+scroll / buttons to zoom, and it glides to HEAD after commands.
   */
  mode?: "fit" | "pan";
  /** Scale to grow from on mount, for a shared-element entrance. */
  introScale?: number;
  /** Reports the fitted scale so another screen can continue from it. */
  onScale?: (scale: number) => void;
  /** Makes only cards that can satisfy the current command argument selectable. */
  referenceKind?: CommandReferenceKind | null;
  onSelectReference?: (commitId: string, branches: string[]) => void;
  className?: string;
}

/** Illustrated commit graph: each card shows the repository snapshot at that commit. */
export function CommitTree({
  repository,
  padding = 16,
  showRefs = true,
  animateIn = true,
  mode = "fit",
  introScale,
  onScale,
  referenceKind,
  onSelectReference,
  className = "",
}: CommitTreeProps) {
  const { t } = useI18n();
  const [ref, box] = useElementSize<HTMLDivElement>();
  const layout = useMemo(() => layoutCommitTree(repository), [repository]);
  const looks = useMemo(
    () => Object.fromEntries(Object.keys(repository.commits).map((id) => [id, chickenLookFromState(getSnapshot(repository, id))])),
    [repository],
  );

  const tagsOf = (id: string) => (showRefs ? branchesAtCommit(repository, id) : []);
  // Every commit takes the colour of the branch that owns it, so a branch reads as one colour.
  const colours = useMemo(() => branchColours(repository), [repository]);
  const lanes = useMemo(() => branchLanes(repository), [repository]);
  const colourOfCommit = (id: string) => colours.get(lanes.get(id) ?? "") ?? UNOWNED;
  const colourOfBranch = (name: string) => colours.get(name) ?? UNOWNED;
  // Two-column trees use the airy Figma spacing; wider trees tighten up.
  const colStep = layout.columns <= 2 ? 130 : CARD_W + 16;
  const rowStep = (layout.rows <= 2 ? 150 : CARD_H + 32) + (showRefs ? TAG_H : 0);
  const minCol = Math.min(...layout.nodes.map((node) => node.col));
  // Both sides keep room for the HEAD pointer so the tree stays centred wherever HEAD is.
  const margin = showRefs ? HEAD_EXTENT : 0;
  const width = (Math.max(...layout.nodes.map((node) => node.col)) - minCol) * colStep + CARD_W + margin * 2;
  const height = (layout.rows - 1) * rowStep + CARD_H + (showRefs ? TAG_H : 0);
  const fitScale = box.width
    ? Math.min(1, (box.width - padding * 2) / width, (box.height - padding * 2) / height)
    : 0;

  useEffect(() => {
    if (mode === "fit" && fitScale > 0) onScale?.(fitScale);
  }, [mode, fitScale, onScale]);

  const position = new Map(
    layout.nodes.map((node) => {
      const x = margin + (node.col - minCol) * colStep;
      const y = node.row * rowStep;
      return [node.id, { x, y, row: node.row, h: CARD_H + (tagsOf(node.id).length ? TAG_H : 0) }];
    }),
  );
  const delayFor = (row: number, x: number) => (animateIn ? row * 0.14 + x / 2000 : 0);

  // HEAD points from the right unless a close neighbour sits there and the left is free.
  const headNode = showRefs ? layout.nodes.find((node) => node.id === repository.head) : undefined;
  const headAt = headNode && position.get(headNode.id);
  const occupied = (row: number, col: number) => layout.nodes.some((node) => node.row === row && node.col === col);
  const headSide: "left" | "right" =
    headNode &&
    colStep - CARD_W < HEAD_EXTENT &&
    occupied(headNode.row, headNode.col + 1) &&
    !occupied(headNode.row, headNode.col - 1)
      ? "left"
      : "right";

  const drawing = (
    <>
      <svg className="absolute inset-0 overflow-visible" width={width} height={height} aria-hidden>
        {layout.edges.map((edge) => {
          const from = position.get(edge.from)!;
          const to = position.get(edge.to)!;
          // A merged-in line belongs to the branch it brings in; any other line to the commit it leads to.
          const colour = colourOfCommit(edge.secondary ? edge.from : edge.to);
          const delay = delayFor(from.row, from.x) + 0.12;
          return (
            <g key={`${edge.from}-${edge.to}`} style={{ color: colour, transition: "color 300ms" }}>
              <motion.path
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={edge.secondary ? "4 3" : undefined}
                initial={animateIn ? { pathLength: 0, opacity: 0, d: connector(from, to) } : false}
                animate={{ pathLength: 1, opacity: 1, d: connector(from, to) }}
                transition={{ duration: 0.45, ease: "easeInOut", delay }}
              />
              <motion.path
                fill="currentColor"
                initial={animateIn ? { opacity: 0, d: arrowhead(to) } : false}
                animate={{ opacity: 1, d: arrowhead(to) }}
                transition={{ duration: 0.15, delay: animateIn ? delay + 0.4 : 0 }}
              />
            </g>
          );
        })}
      </svg>
      <AnimatePresence initial={animateIn}>
        {layout.nodes.map((node) => {
          const at = position.get(node.id)!;
          const branches = tagsOf(node.id);
          const branch = pickBranchReference(branches, repository.currentBranch);
          const selectable = referenceKind === "commit" || (referenceKind === "branch" && branch !== null);
          const selectionLabel = referenceKind === "commit"
            ? t("graph.selectCommit", { commit: node.id })
            : branch
              ? t("graph.selectBranch", { branch })
              : undefined;
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
                branches={branches}
                currentBranch={repository.currentBranch}
                colour={colourOfCommit(node.id)}
                colourOf={colourOfBranch}
                onSelect={selectable && onSelectReference
                  ? () => onSelectReference(node.id, branches)
                  : undefined}
                selectionLabel={selectable ? selectionLabel : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {headAt && (
        // One pointer for the whole tree, so it glides from card to card as HEAD moves.
        <motion.div
          className="absolute"
          initial={{ opacity: 0, left: headLeft(headAt.x, headSide), top: headAt.y }}
          animate={{ opacity: 1, left: headLeft(headAt.x, headSide), top: headAt.y }}
          transition={{ ...spring.snappy, opacity: { duration: 0.2, delay: delayFor(headAt.row, headAt.x) + 0.3 } }}
        >
          <HeadPointer side={headSide} />
        </motion.div>
      )}
    </>
  );

  if (mode === "pan") {
    const head = position.get(repository.head);
    const focus = head ? { x: head.x + CARD_W / 2, y: head.y + head.h / 2 } : { x: width / 2, y: height / 2 };
    return (
      <PanCanvas
        containerRef={ref}
        view={box}
        content={{ width, height }}
        focus={focus}
        introScale={introScale}
        className={className}
      >
        {drawing}
      </PanCanvas>
    );
  }

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {fitScale > 0 && (
        <motion.div
          className="absolute left-1/2 top-1/2"
          style={{ width, height, x: "-50%", y: "-50%" }}
          initial={false}
          animate={{ scale: fitScale }}
          transition={spring.soft}
        >
          {drawing}
        </motion.div>
      )}
    </div>
  );
}

interface PanCanvasProps {
  containerRef: RefObject<HTMLDivElement>;
  view: Size;
  content: Size;
  /** Content point to keep in view: HEAD. */
  focus: { x: number; y: number };
  introScale?: number;
  className: string;
  children: ReactNode;
}

/**
 * A camera over the drawing. Only the drawing moves: `touch-action: none` and
 * non-passive wheel/gesture handlers keep the browser from zooming the page.
 */
function PanCanvas({ containerRef, view, content, focus, introScale, className, children }: PanCanvasProps) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(introScale ?? 1);
  const values: [MotionValue<number>, keyof Camera][] = [[x, "x"], [y, "y"], [scale, "scale"]];
  const read = (): Camera => ({ x: x.get(), y: y.get(), scale: scale.get() });
  const stop = () => values.forEach(([value]) => value.stop());
  const jump = (camera: Camera) => {
    stop();
    const clamped = clampPan(camera, view, content);
    values.forEach(([value, key]) => value.set(clamped[key]));
  };
  const glide = (camera: Camera) => {
    const clamped = clampPan(camera, view, content);
    values.forEach(([value, key]) => animate(value, clamped[key], spring.soft));
  };

  // Frame HEAD on first layout and glide to it whenever it moves or the view resizes.
  const framed = useRef(false);
  useEffect(() => {
    if (!view.width || !view.height) return;
    if (!framed.current) {
      framed.current = true;
      if (introScale) {
        jump(centerOn({ x: content.width / 2, y: content.height / 2 }, view, introScale));
        glide(centerOn(focus, view, 1));
      } else {
        jump(centerOn(focus, view, 1));
      }
      return;
    }
    glide(centerOn(focus, view, scale.get()));
    // Re-frame only when HEAD's position or the viewport changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.x, focus.y, view.width, view.height]);

  // Pointer pan and two-finger pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ camera: Camera; distance: number; mid: { x: number; y: number } } | null>(null);
  const local = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const pinchState = () => {
    const [a, b] = [...pointers.current.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stop();
    pointers.current.set(event.pointerId, local(event));
    if (pointers.current.size === 2) pinch.current = { camera: read(), ...pinchState() };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      const camera = read();
      jump({ ...camera, x: camera.x + point.x - previous.x, y: camera.y + point.y - previous.y });
    } else if (pointers.current.size === 2 && pinch.current) {
      const { distance, mid } = pinchState();
      const start = pinch.current;
      const zoomed = zoomAt(start.camera, start.mid, (start.camera.scale * distance) / start.distance);
      jump({ ...zoomed, x: zoomed.x + mid.x - start.mid.x, y: zoomed.y + mid.y - start.mid.y });
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // Wheel: trackpad pinch and ctrl/cmd+wheel zoom; plain scrolling pans. Safari's
  // gesture events cover trackpad pinch there. All are non-passive to stop page zoom.
  const latest = useRef({ read, jump, local });
  latest.current = { read, jump, local };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    let gestureStart: Camera | null = null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { read: current, jump: move, local: toLocal } = latest.current;
      const camera = current();
      if (event.ctrlKey || event.metaKey) {
        move(zoomAt(camera, toLocal(event), camera.scale * Math.exp(-event.deltaY * 0.01)));
      } else {
        move({ ...camera, x: camera.x - event.deltaX, y: camera.y - event.deltaY });
      }
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStart = latest.current.read();
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & { scale: number; clientX: number; clientY: number };
      if (gestureStart) latest.current.jump(zoomAt(gestureStart, latest.current.local(gesture), gestureStart.scale * gesture.scale));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("gesturestart", onGestureStart, { passive: false });
    element.addEventListener("gesturechange", onGestureChange, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
    };
  }, [containerRef]);

  const center = { x: view.width / 2, y: view.height / 2 };
  const zoomBy = (factor: number) => glide(zoomAt(read(), center, scale.get() * factor));

  return (
    <div
      ref={containerRef}
      className={`relative cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: content.width, height: content.height, x, y, scale, originX: 0, originY: 0 }}
      >
        {children}
      </motion.div>
      <div className="absolute bottom-3 right-3 flex gap-1">
        <CanvasButton icon="my_location" label={t("graph.centre")} onClick={() => glide(centerOn(focus, view, 1))} />
        <CanvasButton icon="remove" label={t("graph.zoomOut")} onClick={() => zoomBy(1 / 1.3)} />
        <CanvasButton icon="add_2" label={t("graph.zoomIn")} onClick={() => zoomBy(1.3)} />
      </div>
    </div>
  );
}

function CanvasButton({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded border border-grey-700 bg-green-950/90 text-lime-400 transition-colors hover:bg-green-950 hover:text-lime-300 active:border-lime-400"
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

export interface CommitCardProps {
  id: string;
  look: ChickenLook;
  branches: string[];
  currentBranch: string;
  /** Attach a HEAD pointer on the right, for cards drawn outside a graph. */
  head?: boolean;
  /** Outline colour: the branch that owns this commit. */
  colour?: string;
  /** Tag colour for each branch name. */
  colourOf?: (branch: string) => string;
  /** Present only while this card is a valid argument for the current command. */
  onSelect?: () => void;
  selectionLabel?: string;
}

/** Trunk lime, anything else the second branch colour: for cards drawn outside a graph. */
const defaultColourOf = (branch: string) =>
  `rgb(var(--colors-branch-${branch === "main" || branch === "master" ? 1 : 2}))`;

/** One Figma "card branch" variant: outline and full-width tag in the branch colour. */
export function CommitCard({
  id,
  look,
  branches,
  currentBranch,
  head = false,
  colour = UNOWNED,
  colourOf = defaultColourOf,
  onSelect,
  selectionLabel,
}: CommitCardProps) {
  const ordered = [...branches].sort((a, b) => Number(b === currentBranch) - Number(a === currentBranch));

  const card = (
    <div className="relative" style={{ width: CARD_W }}>
      <div
        className={`flex flex-col overflow-hidden rounded border bg-green-900 transition ${onSelect ? "group-hover:brightness-125 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-lime-400" : ""}`}
        style={{ borderColor: colour, transition: "border-color 300ms" }}
      >
        <AnimatePresence initial={false}>
          {ordered.length > 0 && (
            <motion.div
              key="tag"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: TAG_H, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.snappy}
              className="flex shrink-0 overflow-hidden"
              title={ordered.join(", ")}
            >
              {/* Segments share the card's full width; names that don't fit stay in the tooltip. */}
              {ordered.map((name, index) => (
                <span
                  key={name}
                  className={`flex-auto truncate px-1 text-2xs leading-[17px] text-green-950 ${index === 0 ? "shrink-0 max-w-full" : "min-w-0"}`}
                  style={{ backgroundColor: colourOf(name), transition: "background-color 300ms" }}
                >
                  {name}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-col gap-1 p-2">
          <PixelChicken look={look} size={48} className="rounded" />
          <span className="truncate text-xs leading-[15px] text-grey-50">{id}</span>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {head && (
          <motion.div
            key="head"
            className="absolute top-0"
            style={{ left: CARD_W + HEAD_GAP }}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 6 }}
            transition={spring.snappy}
          >
            <HeadPointer side="right" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!onSelect) return card;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={selectionLabel}
      title={selectionLabel}
      className="group block cursor-pointer rounded text-left"
    >
      {card}
    </button>
  );
}

/** Where the HEAD pointer starts so its tip sits HEAD_GAP from the card's side. */
function headLeft(cardX: number, side: "left" | "right"): number {
  return side === "right" ? cardX + CARD_W + HEAD_GAP : cardX - HEAD_EXTENT;
}

/** Lime "HEAD" label level with the branch tag; `side` is where it sits, tip facing the card. */
export function HeadPointer({ side }: { side: "left" | "right" }) {
  const tip = `${HEAD_TIP}px`;
  return (
    <div
      aria-label="HEAD"
      className="flex items-center justify-center bg-lime-400 text-2xs text-green-950"
      style={{
        width: HEAD_EXTENT - HEAD_GAP,
        height: TAG_H,
        clipPath:
          side === "right"
            ? `polygon(0 50%, ${tip} 0, 100% 0, 100% 100%, ${tip} 100%)`
            : `polygon(0 0, calc(100% - ${tip}) 0, 100% 50%, calc(100% - ${tip}) 100%, 0 100%)`,
        [side === "right" ? "paddingLeft" : "paddingRight"]: HEAD_TIP,
      }}
    >
      HEAD
    </div>
  );
}

/** A filled arrowhead whose tip touches the child card's top edge. */
function arrowhead(to: { x: number; y: number }): string {
  const x = to.x + CARD_W / 2;
  return `M${x - ARROW_W} ${to.y - ARROW_L}L${x} ${to.y}L${x + ARROW_W} ${to.y - ARROW_L}Z`;
}

/** Figma connectors leave the parent's side at mid-height, then drop to the child. */
function connector(from: { x: number; y: number; h: number }, to: { x: number; y: number }): string {
  const fromCenter = from.x + CARD_W / 2;
  const toCenter = to.x + CARD_W / 2;
  if (Math.abs(fromCenter - toCenter) < 1) return `M${fromCenter} ${from.y + from.h}V${to.y}`;
  const side = toCenter < fromCenter ? from.x : from.x + CARD_W;
  return `M${side} ${from.y + from.h / 2}H${toCenter}V${to.y}`;
}
