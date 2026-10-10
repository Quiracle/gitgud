import { AnimatePresence, motion, useAnimationControls, type Variants } from "motion/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import type { SemanticState } from "../../engine";
import { useI18n, type I18nValue } from "../../i18n/I18nProvider";
import { CHICKEN_COLORS, type ChickenColor } from "../../puzzles/chickenTheme";
import { spring } from "../../lib/motion";
import { CHICKEN_PIXELS, type PixelLayer } from "./chickenPixels";

/** "default" keeps the colours drawn in Figma; a ChickenColor recolours the part. */
export type ChickenTint = ChickenColor | "default";
export type ChickenPart = "crest" | "longLegs" | "scarf" | "sunglasses" | "hat";

/**
 * What a snapshot looks like. Every layer is optional: an empty repository is an empty
 * grey square, and a branch that only adds a scarf shows just the scarf.
 */
export interface ChickenLook {
  chicken: boolean;
  /** Body colour; "default" is the Figma cream. */
  body: ChickenTint;
  parts: Partial<Record<ChickenPart, ChickenTint>>;
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
const DESIGN_TONES: Record<ChickenPart, Tone> = {
  crest: TINTS.red,
  hat: TINTS.red,
  scarf: TINTS.red,
  sunglasses: TINTS.black,
  longLegs: { base: "#fdb874", shade: "#fdb874", light: "#fdb874" },
};

const OUTLINE = "#0b0b0b";
const BACKGROUND = "#fafafa";
const BODY_CREAM = "#fefce8";
const bodyColors = (tint: ChickenTint) => ({
  o: OUTLINE,
  // Bodies use the light tone so a coloured chicken stays readable against its outline.
  b: tint === "default" ? BODY_CREAM : TINTS[tint].light,
  k: "#ff4733",
  f: "#fdb874",
  g: BACKGROUND,
});

/** Bottom-to-top paint order of the optional parts. */
const PART_ORDER: ChickenPart[] = ["crest", "longLegs", "scarf", "sunglasses", "hat"];

const leave = { opacity: 0, transition: { duration: 0.16 } };

/** Each layer arrives in a way that suits it. Origins are fractions of the layer box. */
const ENTRANCES: Record<ChickenPart | "chicken", { variants: Variants; origin: [number, number] }> = {
  chicken: {
    variants: {
      hidden: { scale: 0.4, opacity: 0 },
      show: { scale: 1, opacity: 1, transition: spring.bouncy },
      gone: { scale: 0.4, ...leave },
    },
    origin: [0.5, 1],
  },
  crest: {
    variants: {
      hidden: { scaleY: 0, opacity: 0 },
      show: { scaleY: 1, opacity: 1, transition: spring.bouncy },
      gone: { scaleY: 0, ...leave },
    },
    origin: [0.5, 1],
  },
  hat: {
    variants: {
      hidden: { y: -12, rotate: -14, opacity: 0 },
      show: { y: 0, rotate: 0, opacity: 1, transition: spring.bouncy },
      gone: { y: -10, rotate: 10, ...leave },
    },
    origin: [0.5, 1],
  },
  sunglasses: {
    variants: {
      hidden: { y: -5, opacity: 0 },
      show: { y: 0, opacity: 1, transition: spring.bouncy },
      gone: { y: -5, ...leave },
    },
    origin: [0.5, 0.5],
  },
  scarf: {
    variants: {
      hidden: { scaleX: 0.2, opacity: 0 },
      show: { scaleX: 1, opacity: 1, transition: spring.bouncy },
      gone: { scaleX: 0.2, ...leave },
    },
    origin: [0, 0.5],
  },
  longLegs: {
    variants: {
      hidden: { scaleY: 0.2, opacity: 0 },
      show: { scaleY: 1, opacity: 1, transition: spring.bouncy },
      gone: { scaleY: 0.2, ...leave },
    },
    origin: [0.5, 0],
  },
};

export const EMPTY_LOOK: ChickenLook = { chicken: false, body: "default", parts: {} };

function tone(part: ChickenPart, tint: ChickenTint): Tone {
  return tint === "default" ? DESIGN_TONES[part] : TINTS[tint];
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === false || value === "none";
}

function tintOf(value: unknown): ChickenTint | undefined {
  if (isAbsent(value)) return undefined;
  return (CHICKEN_COLORS as readonly string[]).includes(value as string) ? (value as ChickenColor) : "default";
}

/**
 * Maps a repository snapshot onto the artwork. `body: "none"` is an empty canvas and a
 * missing `body` is the cream chicken. Legacy truthy values (`sunglasses: true`) fall
 * back to the Figma colours.
 */
export function chickenLookFromState(state: SemanticState): ChickenLook {
  const parts: ChickenLook["parts"] = {};
  for (const part of PART_ORDER) {
    const tint = tintOf(state[part]);
    if (tint) parts[part] = tint;
  }
  const bodyAbsent = "body" in state && isAbsent(state.body);
  const body = state.body === "cream" || bodyAbsent ? "default" : (tintOf(state.body) ?? "default");
  return { chicken: !bodyAbsent, body, parts };
}

/**
 * The layers a look paints, bottom to top, with their colours, for static renders such
 * as the share card. Follows the same feet and crest rules as PixelChicken.
 */
export function chickenPaintLayers(look: ChickenLook): { layer: PixelLayer; colors: Record<string, string> }[] {
  const layers: { layer: PixelLayer; colors: Record<string, string> }[] = [];
  if (look.chicken) {
    const body = bodyColors(look.body);
    layers.push({ layer: CHICKEN_PIXELS.chicken, colors: body });
    if (!look.parts.longLegs) layers.push({ layer: CHICKEN_PIXELS.feet, colors: body });
  }
  for (const part of PART_ORDER) {
    const tint = look.parts[part];
    if (!tint || (part === "crest" && look.parts.hat)) continue;
    const t = tone(part, tint);
    layers.push({ layer: CHICKEN_PIXELS[part], colors: { o: OUTLINE, p: t.base, s: t.shade, l: t.light, g: BACKGROUND } });
  }
  return layers;
}

/** Colour behind every chicken; also the share card's tile. */
export const CHICKEN_BACKGROUND = BACKGROUND;
export const CHICKEN_OUTLINE = OUTLINE;

interface PixelChickenProps {
  look: ChickenLook;
  /** Rendered edge length in CSS pixels. Use className to override responsively. */
  size?: number;
  className?: string;
  label?: string;
}

/** Layered pixel-art chicken on the grey-50 tile. Changes animate; first paint is static. */
export function PixelChicken({ look, size = 48, className = "", label }: PixelChickenProps) {
  const i18n = useI18n();
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

  const body = useMemo(() => bodyColors(look.body), [look.body]);

  return (
    <svg
      role="img"
      aria-label={label ?? describe(look, i18n)}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`block shrink-0 ${className}`}
    >
      <rect width="32" height="32" fill={BACKGROUND} />
      <motion.g animate={controls} style={{ originX: 0.5, originY: 0.82 }}>
        <AnimatePresence initial={false}>
          {look.chicken && (
            <AnimatedLayer key="chicken" entrance="chicken" layer={CHICKEN_PIXELS.chicken} colors={body}>
              {/* Long legs bring their own feet; drawing both leaves the short feet poking out. */}
              {!look.parts.longLegs && <Layer layer={CHICKEN_PIXELS.feet} colors={body} />}
            </AnimatedLayer>
          )}
          {PART_ORDER.map((part) => {
            const tint = look.parts[part];
            // A hat sits where the crest is, so the crest would poke out under the brim.
            if (!tint || (part === "crest" && look.parts.hat)) return null;
            const t = tone(part, tint);
            return (
              <AnimatedLayer
                key={part}
                entrance={part}
                layer={CHICKEN_PIXELS[part]}
                colors={{ o: OUTLINE, p: t.base, s: t.shade, l: t.light, g: BACKGROUND }}
              />
            );
          })}
        </AnimatePresence>
      </motion.g>
    </svg>
  );
}

function AnimatedLayer({
  entrance,
  layer,
  colors,
  children,
}: {
  entrance: keyof typeof ENTRANCES;
  layer: PixelLayer;
  colors: Record<string, string>;
  children?: ReactNode;
}) {
  const { variants, origin } = ENTRANCES[entrance];
  return (
    <motion.g variants={variants} initial="hidden" animate="show" exit="gone" style={{ originX: origin[0], originY: origin[1] }}>
      <Layer layer={layer} colors={colors} />
      {children}
    </motion.g>
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

/** The screen-reader description, e.g. "A chicken with blue hat and red crest". */
function describe(look: ChickenLook, { t, formatList }: Pick<I18nValue, "t" | "formatList">): string {
  const parts = PART_ORDER.filter((part) => look.parts[part]).map((part) => {
    const tint = look.parts[part]!;
    const name = t(`chicken.part.${part}`);
    return tint === "default" ? name : t("chicken.tinted", { part: name, color: t(`chicken.color.${tint}`) });
  });
  const list = formatList(parts);
  if (!look.chicken) return parts.length ? t("chicken.just", { parts: list }) : t("chicken.empty");
  const chicken = look.body === "default" ? t("chicken.plain") : t("chicken.colored", { color: t(`chicken.color.${look.body}`) });
  return parts.length ? t("chicken.with", { chicken, parts: list }) : chicken;
}
