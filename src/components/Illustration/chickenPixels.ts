// Generated from the Figma "chicken assets" component set (node 28:96273).
// The comb is split out of the base chicken so `crest` can add, remove, or recolour it.
// Each layer is a 32x32 grid; rows start at `top`. Roles:
// o outline, b body, k cheek, f feet/beak, g background mask,
// p primary, s shade, l light. Spaces are transparent.

export interface PixelLayer {
  top: number;
  rows: readonly string[];
}

export const CHICKEN_PIXELS = {
  crest: {
    top: 6,
    rows: [
      "                 oooo",
      "                oppppo",
      "                 oppppo",
    ],
  },
  chicken: {
    top: 9,
    rows: [
      "                  ooooo",
      "        oo       obbbbbo",
      "       obbo      obbbbbo",
      "      obbbboo    obbobboo",
      "      obbbbbboooobbboboffo",
      "       obbbbbbbbbbbkkbboo",
      "       obbbbbbbbbbbbbbbo",
      "      obbbbbbbbbbbbbbbbbo",
      "      obbbbobbbbbbbbbbbbo",
      "      obbbobbbbbbbbbbbbbo",
      "       obbobbbbobbbbbbbbo",
      "       obbboooobbbbbbbbbo",
      "        obbbbbbbbbbbbbbo",
      "         ooobobbbbbbooo",
      "            ofoooooo",
      "            offffoffo",
      "             oooo oo",
    ],
  },
  longLegs: {
    top: 23,
    rows: [
      "            opoooooo",
      "            opogopog",
      "            opogopog",
      "            opogopog",
      "            opoooooo",
      "            oppppopp",
      "             oooo oo",
    ],
  },
  sunglasses: {
    top: 11,
    rows: [
      "                    oo ooo",
      "                   oplo  lo",
      "                   opp    o",
      "                    oo   o",
    ],
  },
  hat: {
    top: 2,
    rows: [
      "                  ooooo",
      "                 opppppo",
      "                 opppppo",
      "                 opppppo",
      "                 opppppo",
      "                 opppppo",
      "                ooooooooo",
      "               opppppppppo",
      "                ooooooooo",
    ],
  },
  scarf: {
    top: 12,
    rows: [
      "               oo",
      "              oppo",
      "              oppo",
      "              opppo    opo",
      "               opppooooppo",
      "                opppppppoo",
      "                 oppppposo",
      "                  ooooospo",
      "                      oppo",
      "                      oppo",
      "                       oo",
    ],
  },
} satisfies Record<string, PixelLayer>;
