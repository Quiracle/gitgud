import { describe, expect, it } from "vitest";
import { CHICKEN_PIXELS } from "./chickenPixels";
import { CHICKEN_BODY_CREAM, CHICKEN_BODY_TINTS, CHICKEN_TINTS, chickenLookFromState } from "./PixelChicken";

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
const MIN_HUE_GAP = 40;

function expectDistinct(colours: Record<string, string>) {
  const chromatic = Object.entries(colours).filter(([name]) => name !== "black");
  for (const [i, [nameA, a]] of chromatic.entries()) {
    for (const [nameB, b] of chromatic.slice(i + 1)) {
      const gap = hueGap(hueSat(a).hue, hueSat(b).hue);
      expect(gap, `${nameA} ${a} vs ${nameB} ${b}`).toBeGreaterThanOrEqual(MIN_HUE_GAP);
    }
  }
}

describe("chicken palette", () => {
  it("keeps accessory colours on clearly different hues", () => {
    expectDistinct(Object.fromEntries(Object.entries(CHICKEN_TINTS).map(([name, tone]) => [name, tone.base])));
  });

  it("keeps body colours on clearly different hues", () => {
    expectDistinct(CHICKEN_BODY_TINTS);
  });

  it("keeps coloured bodies saturated enough to never read as the cream chicken", () => {
    expect(hueSat(CHICKEN_BODY_CREAM).chroma).toBeLessThan(0.1);
    for (const [name, colour] of Object.entries(CHICKEN_BODY_TINTS)) {
      if (name === "black") continue;
      expect(hueSat(colour).chroma, `${name} ${colour}`).toBeGreaterThanOrEqual(0.4);
    }
  });
});
