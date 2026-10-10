import { describe, expect, it } from "vitest";
import { CHICKEN_COLORS } from "../puzzles/chickenTheme";
import { randomChickenLook } from "./randomChicken";

describe("randomChickenLook", () => {
  it("always draws a crested chicken with known tints", () => {
    const tints = new Set<string>(["default", ...CHICKEN_COLORS]);
    for (let i = 0; i < 200; i += 1) {
      const look = randomChickenLook();
      expect(look.chicken).toBe(true);
      expect(look.parts.crest).toBe("default");
      expect(tints.has(look.body)).toBe(true);
      for (const tint of Object.values(look.parts)) expect(tints.has(tint!)).toBe(true);
    }
  });

  it("is plain when every roll comes up high and fully dressed when every roll comes up low", () => {
    expect(randomChickenLook(() => 0.99)).toEqual({ chicken: true, body: "default", parts: { crest: "default" } });
    const dressed = randomChickenLook(() => 0);
    expect(dressed.body).toBe(CHICKEN_COLORS[0]);
    expect(Object.keys(dressed.parts).sort()).toEqual(["crest", "hat", "longLegs", "scarf", "sunglasses"]);
  });
});
