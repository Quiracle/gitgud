import type { ChickenLook, ChickenPart, ChickenTint } from "../components/Illustration/PixelChicken";
import { CHICKEN_COLORS } from "../puzzles/chickenTheme";

const ACCESSORIES: ChickenPart[] = ["hat", "scarf", "sunglasses", "longLegs"];

/** A chicken in a random outfit: half the time cream, each accessory a coin flip in a random tint. */
export function randomChickenLook(random: () => number = Math.random): ChickenLook {
  const tint = (): ChickenTint => {
    const pick = Math.floor(random() * (CHICKEN_COLORS.length + 1));
    return pick === CHICKEN_COLORS.length ? "default" : CHICKEN_COLORS[pick];
  };
  const body = random() < 0.5 ? tint() : "default";
  const parts: ChickenLook["parts"] = { crest: "default" };
  for (const part of ACCESSORIES) {
    if (random() < 0.5) parts[part] = tint();
  }
  return { chicken: true, body, parts };
}
