import { describe, expect, it } from "vitest";
import { CHICKEN_PIXELS } from "./chickenPixels";
import { chickenLookFromState } from "./PixelChicken";

describe("chickenLookFromState", () => {
  it("keeps Figma colours for an undecorated chicken", () => {
    expect(
      chickenLookFromState({ sunglasses: "none", hat: "none", scarf: "none", crest: "none", longLegs: "none" }),
    ).toEqual({ body: "default", crest: "default", accessories: {} });
  });

  it("maps colours onto layered accessories", () => {
    expect(chickenLookFromState({ hat: "blue", scarf: "red", sunglasses: "none", crest: "gold", longLegs: "purple" })).toEqual({
      body: "default",
      crest: "gold",
      accessories: { hat: "blue", scarf: "red", longLegs: "purple" },
    });
  });

  it("treats legacy truthy values as the designed colour", () => {
    expect(chickenLookFromState({ sunglasses: true, hat: false }).accessories).toEqual({ sunglasses: "default" });
  });
});

describe("chicken pixel layers", () => {
  it("fit the 32x32 Figma grid and use known roles", () => {
    for (const layer of Object.values(CHICKEN_PIXELS)) {
      expect(layer.top + layer.rows.length).toBeLessThanOrEqual(32);
      for (const row of layer.rows) {
        expect(row.length).toBeLessThanOrEqual(32);
        expect(row).toMatch(/^[ obckfgpsl]*$/);
      }
    }
  });
});
