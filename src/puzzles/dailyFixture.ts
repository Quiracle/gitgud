import type { Repository } from "../engine";
import { DAILY_PUZZLE_SCHEMA_VERSION, type PublicPuzzleDefinition } from "./types";

export function createDailyFixture(date: string): PublicPuzzleDefinition {
  const initialState = {
    sunglasses: "none",
    hat: "none",
    scarf: "none",
    crest: "none",
    longLegs: "none",
  };

  return {
    schemaVersion: DAILY_PUZZLE_SCHEMA_VERSION,
    themeId: "chicken-v1",
    id: `daily-${date}`,
    version: 1,
    kind: "daily",
    slug: `daily-${date}`,
    publishedOn: date,
    difficulty: "easy",
    title: "The chicken's beach disguise",
    description: "For a beach holiday portrait, bring the red sunglasses from the style branch onto main.",
    parCommands: 1,
    initialRepository: {
      initialState,
      currentBranch: "main",
      head: "m20",
      nextGeneratedId: 1,
      branches: { main: "m20", style: "s20" },
      commits: {
        a10: {
          id: "a10", parents: [], message: "Start the beach chicken portrait", changes: [],
          provenance: { type: "original" },
        },
        m20: {
          id: "m20", parents: ["a10"], message: "Prepare the beach backdrop", changes: [],
          provenance: { type: "original" },
        },
        s20: {
          id: "s20", parents: ["a10"], message: "Add red sunglasses", changes: [
            { type: "set", property: "sunglasses", from: "none", to: "red" },
          ],
          provenance: { type: "original" },
        },
      },
    } satisfies Repository,
    target: { branch: "main", snapshot: { ...initialState, sunglasses: "red" } },
    allowedCommands: ["switch", "log", "merge", "cherry-pick", "revert", "rebase", "interactive-rebase"],
    hints: ["Inspect every branch before changing history.", "One commit can be copied onto main."],
  };
}
