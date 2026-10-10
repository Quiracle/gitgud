import type { SemanticState } from "../engine";
import type { SemanticPolicy } from "./policy";

export const CHICKEN_THEME_ID = "chicken-v1" as const;

export const CHICKEN_ACCESSORY_SLOTS = [
  "sunglasses",
  "hat",
  "scarf",
  "crest",
  "longLegs",
] as const;

export const CHICKEN_COLORS = [
  "black",
  "red",
  "blue",
  "turquoise",
  "purple",
  "gold",
] as const;

/**
 * The chicken itself. "none" is an empty canvas (e.g. a root commit before the chicken
 * is drawn), "cream" is the Figma default, and colours recolour the body. Optional:
 * a state without `body` shows the cream chicken, so published puzzles stay valid.
 */
export const CHICKEN_BODY_VALUES = ["none", "cream", ...CHICKEN_COLORS] as const;

export type ChickenAccessorySlot = (typeof CHICKEN_ACCESSORY_SLOTS)[number];
export type ChickenColor = (typeof CHICKEN_COLORS)[number];
export type ChickenAccessoryValue = ChickenColor | "none";
export type ChickenBodyValue = (typeof CHICKEN_BODY_VALUES)[number];
export type ChickenState = Record<ChickenAccessorySlot, ChickenAccessoryValue> & { body?: ChickenBodyValue };

export const EMPTY_CHICKEN_STATE: ChickenState = {
  sunglasses: "none",
  hat: "none",
  scarf: "none",
  crest: "none",
  longLegs: "none",
};

const allowedValues = ["none", ...CHICKEN_COLORS] as const;

export const CHICKEN_V2_SEMANTIC_POLICY: SemanticPolicy = {
  properties: {
    ...Object.fromEntries(CHICKEN_ACCESSORY_SLOTS.map((slot) => [slot, allowedValues])),
    body: CHICKEN_BODY_VALUES,
  },
  // `body` is optional: absent means the default cream chicken.
  requiredProperties: CHICKEN_ACCESSORY_SLOTS,
};

export interface ChickenAssetDefinition {
  slot: ChickenAccessorySlot;
  path: string;
  layer: number;
  recolorable: true;
}

/** Stable contract for final SVG artwork. Missing files intentionally use the emoji fallback. */
export const CHICKEN_ASSET_MANIFEST: Record<ChickenAccessorySlot, ChickenAssetDefinition> = {
  longLegs: { slot: "longLegs", path: "/assets/chicken/long-legs.svg", layer: 10, recolorable: true },
  crest: { slot: "crest", path: "/assets/chicken/crest.svg", layer: 20, recolorable: true },
  scarf: { slot: "scarf", path: "/assets/chicken/scarf.svg", layer: 30, recolorable: true },
  hat: { slot: "hat", path: "/assets/chicken/hat.svg", layer: 40, recolorable: true },
  sunglasses: { slot: "sunglasses", path: "/assets/chicken/sunglasses.svg", layer: 50, recolorable: true },
};

export const CHICKEN_COLOR_HEX: Record<ChickenColor, string> = {
  black: "#111827",
  red: "#ef4444",
  blue: "#3b82f6",
  turquoise: "#2dd4bf",
  purple: "#a855f7",
  gold: "#f59e0b",
};

export function isChickenState(state: SemanticState): state is ChickenState {
  return (
    CHICKEN_ACCESSORY_SLOTS.every((slot) => allowedValues.includes(state[slot] as ChickenAccessoryValue)) &&
    (state.body === undefined || CHICKEN_BODY_VALUES.includes(state.body as ChickenBodyValue))
  );
}
