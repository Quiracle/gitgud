import type { Repository } from "../engine";
import { PUZZLE_SCHEMA_VERSION, type PublicPuzzleDefinition } from "./types";

const initialState = {
  sunglasses: false,
  hat: "none",
  scarf: "none",
  crest: "red",
};

export const chickenCoronationPuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "chicken-coronation",
  version: 1,
  kind: "lesson",
  slug: "chicken-coronation",
  difficulty: "easy",
  title: "The chicken's missing scarf",
  description:
    "The main branch contains unwanted sunglasses, while the style branch contains the turquoise scarf we need.",
  objectives: [
    "Finish on the main branch.",
    "Undo commit b22 without rewriting history.",
    "Bring commit s14 onto main.",
    "Match the target chicken state.",
  ],
  initialRepository: {
    initialState,
    currentBranch: "main",
    head: "b22",
    nextGeneratedId: 1,
    branches: {
      main: "b22",
      style: "s14",
    },
    commits: {
      a10: {
        id: "a10",
        parents: [],
        message: "Start the royal chicken portrait",
        changes: [],
        provenance: { type: "original" },
      },
      b22: {
        id: "b22",
        parents: ["a10"],
        message: "Add sunglasses for the photoshoot",
        changes: [
          { type: "set", property: "sunglasses", from: false, to: true },
        ],
        provenance: { type: "original" },
      },
      s14: {
        id: "s14",
        parents: ["a10"],
        message: "Add the turquoise ceremonial scarf",
        changes: [
          {
            type: "set",
            property: "scarf",
            from: "none",
            to: "turquoise",
          },
        ],
        provenance: { type: "original" },
      },
    },
  } satisfies Repository,
  target: {
    branch: "main",
    snapshot: {
      ...initialState,
      scarf: "turquoise",
    },
    requiredProvenance: [
      { type: "revert", sourceCommit: "b22" },
    ],
  },
  allowedCommands: ["switch", "log", "merge", "cherry-pick", "revert"],
  hints: [
    "One existing commit changes the scarf, and another can be safely undone.",
  ],
};
