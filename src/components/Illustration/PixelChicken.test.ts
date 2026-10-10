import { describe, expect, it } from "vitest";
import { CHICKEN_PIXELS } from "./chickenPixels";
import { chickenLookFromState } from "./PixelChicken";

describe("chickenLookFromState", () => {
  it("keeps Figma colours for an undecorated chicken", () => {
    expect(
      chickenLookFromState({ sunglasses: "none", hat: "none", scarf: "none", crest: "none", longLegs: "none" }),
    ).toEqual({ chicken: true, parts: {} });
  });

  it("maps colours onto layered accessories", () => {
    expect(chickenLookFromState({ hat: "blue", scarf: "red", sunglasses: "none", crest: "gold", longLegs: "purple" })).toEqual({
      chicken: true,
      parts: { hat: "blue", scarf: "red", crest: "gold", longLegs: "purple" },
    });
  });

  it("treats legacy truthy values as the designed colour", () => {
    expect(chickenLookFromState({ sunglasses: true, hat: false }).parts).toEqual({ sunglasses: "default" });
  });

  it("hides the body only when the state says the chicken is absent", () => {
    expect(chickenLookFromState({ chicken: "none", scarf: "red" })).toEqual({ chicken: false, parts: { scarf: "red" } });
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
});
