import type { SemanticPolicy } from "../policy";

export const CHICKEN_SEMANTIC_POLICY: SemanticPolicy = {
  properties: {
    sunglasses: [false, true],
    hat: ["none", "blue"],
    scarf: ["none", "turquoise"],
    crest: ["none", "outline", "red"],
  },
};
