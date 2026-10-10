import { describe, expect, it } from "vitest";
import { CHICKEN_PIXELS } from "./chickenPixels";
import { chickenLookFromState } from "./PixelChicken";

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
