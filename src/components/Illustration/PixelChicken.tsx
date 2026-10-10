import { AnimatePresence, motion, useAnimationControls, type Variants } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { SemanticState } from "../../engine";
import { CHICKEN_COLORS, type ChickenColor } from "../../puzzles/chickenTheme";
import { spring } from "../../lib/motion";
import { CHICKEN_PIXELS, type PixelLayer } from "./chickenPixels";

/** "default" keeps the colours drawn in Figma; a ChickenColor recolours the part. */
export type ChickenTint = ChickenColor | "default";
export type ChickenAccessory = "longLegs" | "scarf" | "sunglasses" | "hat";

export interface ChickenLook {
  body: ChickenTint;
  crest: ChickenTint;
  accessories: Partial<Record<ChickenAccessory, ChickenTint>>;
}

interface Tone {
  base: string;
  shade: string;
  light: string;
}

/* Palette colours come from the Figma variables. Blue is the hat blue from the Figma
   frame; turquoise and purple are not in the Figma palette yet and are provisional. */
const TINTS: Record<ChickenColor, Tone> = {
  red: { base: "#ff4733", shade: "#a51e0f", light: "#ff7364" },
  black: { base: "#272727", shade: "#0b0b0b", light: "#535353" },
  blue: { base: "#8ca6e6", shade: "#4a64a8", light: "#c3d1f3" },
  turquoise: { base: "#2dd4bf", shade: "#0f766e", light: "#99f6e4" },
  purple: { base: "#a78bfa", shade: "#6d28d9", light: "#ddd6fe" },
  gold: { base: "#fbdd31", shade: "#c88b06", light: "#fdf08b" },
};

/** Colours each part has in the Figma artwork. */
const DESIGN_TONES: Record<ChickenAccessory | "body" | "crest", Tone> = {
  body: { base: "#fefce8", shade: "#fefce8", light: "#fefce8" },
  crest: TINTS.red,
  hat: TINTS.red,
  scarf: TINTS.red,
  sunglasses: TINTS.black,
  longLegs: { base: "#fdb874", shade: "#fdb874", light: "#fdb874" },
};

const OUTLINE = "#0b0b0b";
const BACKGROUND = "#fafafa";
const CHEEK = "#ff4733";
const FEET = "#fdb874";

/** Bottom-to-top paint order. */
const ACCESSORY_ORDER: ChickenAccessory[] = ["longLegs", "scarf", "sunglasses", "hat"];

type Entrance = { variants: Variants; origin: [number, number] };

/** Each accessory arrives in a way that suits it. Origins are fractions of the layer box. */
const ENTRANCES: Record<ChickenAccessory, Entrance> = {
  hat: {
    variants: {
      hidden: { y: -12, rotate: -14, opacity: 0 },
      show: { y: 0, rotate: 0, opacity: 1, transition: spring.bouncy },
      gone: { y: -10, rotate: 10, opacity: 0, transition: { duration: 0.18 } },
    },
    origin: [0.5, 1],
  },
  sunglasses: {
    variants: {
      hidden: { y: -5, opacity: 0 },
      show: { y: 0, opacity: 1, transition: spring.bouncy },
      gone: { y: -5, opacity: 0, transition: { duration: 0.15 } },
    },
    origin: [0.5, 0.5],
  },
  scarf: {
    variants: {
      hidden: { scaleX: 0.2, opacity: 0 },
      show: { scaleX: 1, opacity: 1, transition: spring.bouncy },
      gone: { scaleX: 0.2, opacity: 0, transition: { duration: 0.15 } },
    },
    origin: [0, 0.5],
  },
  longLegs: {
    variants: {
      hidden: { scaleY: 0.2, opacity: 0 },
      show: { scaleY: 1, opacity: 1, transition: spring.bouncy },
      gone: { scaleY: 0.2, opacity: 0, transition: { duration: 0.15 } },
    },
    origin: [0.5, 0],
  },
};

const DEFAULT_LOOK: ChickenLook = { body: "default", crest: "default", accessories: {} };

function tone(part: keyof typeof DESIGN_TONES, tint: ChickenTint): Tone {
  return tint === "default" ? DESIGN_TONES[part] : TINTS[tint];
}

function tintOf(value: unknown): ChickenTint | undefined {
  if (value === undefined || value === null || value === false || value === "none") return undefined;
  return (CHICKEN_COLORS as readonly string[]).includes(value as string) ? (value as ChickenColor) : "default";
}

/**
 * Maps a repository snapshot onto the artwork. Unknown or legacy truthy values
 * (`sunglasses: true`) fall back to the Figma colours.
 */
export function chickenLookFromState(state: SemanticState): ChickenLook {
  const accessories: ChickenLook["accessories"] = {};
  for (const slot of ACCESSORY_ORDER) {
    const tint = tintOf(state[slot]);
    if (tint) accessories[slot] = tint;
  }
  return {
    body: tintOf(state.body) ?? "default",
    crest: tintOf(state.crest) ?? "default",
    accessories,
  };
}

interface PixelChickenProps {
  look?: ChickenLook;
  /** Rendered edge length in CSS pixels. */
  size?: number;
  /** Hide the chicken body and show only accessories, as on commit cards that show a change. */
  accessoriesOnly?: boolean;
  /** Fade the body behind accessories (Figma "Scarf" commit card). */
  ghostBody?: boolean;
  className?: string;
  label?: string;
}

/** Layered pixel-art chicken. Accessory changes animate in place; first paint is static. */
export function PixelChicken({
  look = DEFAULT_LOOK,
  size = 48,
  accessoriesOnly = false,
  ghostBody = false,
  className = "",
  label,
}: PixelChickenProps) {
  const signature = JSON.stringify(look);
  const controls = useAnimationControls();
  const firstRender = useRef(true);

  // A little squash-and-stretch whenever the look changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void controls.start({
      scaleY: [1, 0.86, 1.08, 1],
      scaleX: [1, 1.1, 0.96, 1],
      transition: { duration: 0.45, ease: "easeOut" },
    });
  }, [signature, controls]);

  const body = tone("body", look.body);
  const crest = tone("crest", look.crest);
  const baseColors = useMemo(
    () => ({ o: OUTLINE, b: body.base, c: crest.base, k: CHEEK, f: FEET, g: BACKGROUND }),
    [body.base, crest.base],
  );

  return (
    <svg
      role="img"
      aria-label={label ?? describe(look)}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`block shrink-0 ${className}`}
    >
      <rect width="32" height="32" fill={BACKGROUND} />
      <motion.g animate={controls} style={{ originX: 0.5, originY: 0.82 }}>
        {!accessoriesOnly && (
          <g opacity={ghostBody ? 0.12 : 1}>
            <Layer layer={CHICKEN_PIXELS.chicken} colors={baseColors} />
          </g>
        )}
        <AnimatePresence initial={false}>
          {ACCESSORY_ORDER.map((slot) => {
            const tint = look.accessories[slot];
            if (!tint) return null;
            const t = tone(slot, tint);
            const entrance = ENTRANCES[slot];
            return (
              <motion.g
                key={slot}
                variants={entrance.variants}
                initial="hidden"
                animate="show"
                exit="gone"
                style={{ originX: entrance.origin[0], originY: entrance.origin[1] }}
              >
                <Layer
                  layer={CHICKEN_PIXELS[slot]}
                  colors={{ o: OUTLINE, p: t.base, s: t.shade, l: t.light, g: BACKGROUND }}
                />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </motion.g>
    </svg>
  );
}

function Layer({ layer, colors }: { layer: PixelLayer; colors: Record<string, string> }) {
  const paths = useMemo(() => layerPaths(layer), [layer]);
  return (
    <>
      {Object.entries(paths).map(([role, d]) => (
        <motion.path
          key={role}
          d={d}
          initial={false}
          animate={{ fill: colors[role] ?? OUTLINE }}
          transition={{ duration: 0.35 }}
        />
      ))}
    </>
  );
}

const pathCache = new WeakMap<PixelLayer, Record<string, string>>();

/** One path per colour role keeps each layer to a handful of DOM nodes. */
function layerPaths(layer: PixelLayer): Record<string, string> {
  const cached = pathCache.get(layer);
  if (cached) return cached;
  const paths: Record<string, string> = {};
  layer.rows.forEach((row, index) => {
    const y = layer.top + index;
    for (let x = 0; x < row.length; x++) {
      const role = row[x];
      if (role === " ") continue;
      // Merge horizontal runs of the same role into one rectangle.
      let run = 1;
      while (row[x + run] === role) run++;
      paths[role] = `${paths[role] ?? ""}M${x} ${y}h${run}v1h-${run}z`;
      x += run - 1;
    }
  });
  pathCache.set(layer, paths);
  return paths;
}

function describe(look: ChickenLook): string {
  const parts = Object.entries(look.accessories).map(([slot, tint]) =>
    `${tint === "default" ? "" : `${tint} `}${slot === "longLegs" ? "long legs" : slot}`,
  );
  const body = look.body === "default" ? "" : `${look.body} `;
  return parts.length ? `A ${body}chicken wearing ${parts.join(", ")}` : `A ${body}chicken`;
}
