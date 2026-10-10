import type { SemanticPolicy } from "../policy";

export const CHICKEN_SEMANTIC_POLICY: SemanticPolicy = {
  properties: {
    sunglasses: [false, true],
    hat: ["none", "blue", "gold", "purple"],
    scarf: ["none", "turquoise", "purple", "red"],
    crest: ["none", "outline", "red"],
    longLegs: [false, true],
  },
};
