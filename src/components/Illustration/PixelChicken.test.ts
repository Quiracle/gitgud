import { describe, expect, it } from "vitest";
import { CHICKEN_PIXELS } from "./chickenPixels";
import { CHICKEN_ACCESSORY_SLOTS, CHICKEN_COLORS } from "../../puzzles/chickenTheme";
import { CHICKEN_BODY_CREAM, CHICKEN_BODY_TINTS, chickenLookFromState, chickenPaintLayers } from "./PixelChicken";

describe("chickenLookFromState", () => {
  it("keeps Figma colours for an undecorated chicken", () => {
    expect(
      chickenLookFromState({ sunglasses: "none", hat: "none", scarf: "none", crest: "none", longLegs: "none" }),
    ).toEqual({ chicken: true, body: "default", parts: {} });
  });

  it("maps colours onto layered accessories", () => {
    expect(chickenLookFromState({ hat: "blue", scarf: "red", sunglasses: "none", crest: "gold", longLegs: "purple" })).toEqual({
      chicken: true,
      body: "default",
      parts: { hat: "blue", scarf: "red", crest: "gold", longLegs: "purple" },
    });
  });

  it("treats legacy truthy values as the designed colour", () => {
    expect(chickenLookFromState({ sunglasses: true, hat: false }).parts).toEqual({ sunglasses: "default" });
  });

  it("draws an empty canvas or a single accessory when body is none", () => {
    expect(chickenLookFromState({ body: "none", scarf: "red" })).toEqual({ chicken: false, body: "default", parts: { scarf: "red" } });
    expect(chickenLookFromState({ body: "none" })).toEqual({ chicken: false, body: "default", parts: {} });
  });

  it("recolours the body and treats cream or a missing body as the default", () => {
    expect(chickenLookFromState({ body: "blue" })).toMatchObject({ chicken: true, body: "blue" });
    expect(chickenLookFromState({ body: "cream" })).toMatchObject({ chicken: true, body: "default" });
    expect(chickenLookFromState({})).toMatchObject({ chicken: true, body: "default" });
  });
});

describe("chicken pixel layers", () => {
  it("fit the 32x32 Figma grid and use known roles", () => {
    for (const layer of Object.values(CHICKEN_PIXELS)) {
      expect(layer.top + layer.rows.length).toBeLessThanOrEqual(32);
      for (const row of layer.rows) {
        expect(row.length).toBeLessThanOrEqual(32);
        expect(row).toMatch(/^[ obkfgpsl]*$/);
      }
    }
  });

  it("keep the short feet out of the body so long legs can replace them", () => {
    const { chicken, feet, longLegs } = CHICKEN_PIXELS;
    expect(chicken.top + chicken.rows.length).toBeLessThanOrEqual(longLegs.top);
    expect(feet.top).toBe(longLegs.top);
  });
});

/** Hue (degrees), HSL saturation and chroma (0-1) of a #rrggbb colour. */
function hueSat(hex: string): { hue: number; sat: number; light: number; chroma: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { hue: 0, sat: 0, light, chroma: 0 };
  const sat = d / (1 - Math.abs(2 * light - 1));
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60;
  return { hue: hue < 0 ? hue + 360 : hue, sat, light, chroma: d };
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const MIN_BODY_HUE_GAP = 40;
/** Sunglasses are a handful of pixels, so accessories need a wider gap than bodies. */
const MIN_ACCESSORY_HUE_GAP = 45;

const isNeutral = (hex: string) => hueSat(hex).chroma < 0.15;

/**
 * Two colours of the same feature must never read alike: a neutral (black) only needs
 * the other colour to be clearly coloured; two coloured ones need a wide hue gap.
 */
function expectDistinct(colours: Record<string, string>, minGap: number) {
  const entries = Object.entries(colours);
  for (const [i, [nameA, a]] of entries.entries()) {
    for (const [nameB, b] of entries.slice(i + 1)) {
      const label = `${nameA} ${a} vs ${nameB} ${b}`;
      if (isNeutral(a) || isNeutral(b)) {
        expect(isNeutral(a) && isNeutral(b), label).toBe(false);
        expect(Math.max(hueSat(a).chroma, hueSat(b).chroma), label).toBeGreaterThanOrEqual(0.4);
        continue;
      }
      expect(hueGap(hueSat(a).hue, hueSat(b).hue), label).toBeGreaterThanOrEqual(minGap);
    }
  }
}

/** The colours a feature is actually painted with in each chicken colour. */
function paintedColours(part: (typeof CHICKEN_ACCESSORY_SLOTS)[number] | "body", key: "p" | "l" | "b") {
  return Object.fromEntries(
    CHICKEN_COLORS.map((colour) => {
      const look =
        part === "body"
          ? { chicken: true, body: colour, parts: {} }
          : { chicken: true, body: "default" as const, parts: { [part]: colour } };
      const layer = chickenPaintLayers(look).find((l) => l.layer === CHICKEN_PIXELS[part === "body" ? "chicken" : part]);
      return [colour, layer!.colors[key]];
    }),
  );
}

describe("chicken palette", () => {
  // Matching colours across features (a blue body with blue sunglasses) is fine; the
  // same feature in two different colours on two commits must never look the same.
  it.each(CHICKEN_ACCESSORY_SLOTS)("paints %s in clearly different colours", (part) => {
    expectDistinct(paintedColours(part, "p"), MIN_ACCESSORY_HUE_GAP);
    expectDistinct(paintedColours(part, "l"), MIN_ACCESSORY_HUE_GAP);
  });

  it("paints bodies in clearly different colours", () => {
    expectDistinct(paintedColours("body", "b"), MIN_BODY_HUE_GAP);
  });

  it("keeps coloured bodies saturated enough to never read as the cream chicken", () => {
    expect(hueSat(CHICKEN_BODY_CREAM).chroma).toBeLessThan(0.1);
    for (const [name, colour] of Object.entries(CHICKEN_BODY_TINTS)) {
      if (name === "black") continue;
      expect(hueSat(colour).chroma, `${name} ${colour}`).toBeGreaterThanOrEqual(0.4);
    }
  });
});
