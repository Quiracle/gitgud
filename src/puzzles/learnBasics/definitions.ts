import type { Commit, Repository, SemanticState } from "../../engine";
import {
  PUZZLE_SCHEMA_VERSION,
  type PublicPuzzleDefinition,
} from "../types";

const emptyChicken: SemanticState = {
  sunglasses: false,
  hat: "none",
  scarf: "none",
  crest: "none",
};

function originalCommit(
  id: string,
  parents: string[],
  message: string,
  changes: Commit["changes"] = [],
): Commit {
  return {
    id,
    parents,
    message,
    changes,
    provenance: { type: "original" },
  };
}

function repository(
  commits: Record<string, Commit>,
  branches: Record<string, string>,
  currentBranch = "main",
): Repository {
  return {
    commits,
    branches,
    currentBranch,
    head: branches[currentBranch],
    initialState: structuredClone(emptyChicken),
    nextGeneratedId: 1,
  };
}

export const inspectHistoryPuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-01-inspect-history",
  version: 1,
  kind: "lesson",
  slug: "inspect-history",
  title: "Inspect repository history",
  description:
    "Read the current branch history, then include every branch to find the hidden scarf work.",
  difficulty: "easy",
  objectives: [
    "Run git log to inspect the current branch.",
    "Run git log --all to include commits on every branch.",
  ],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      b20: originalCommit("b20", ["a10"], "Add sunglasses", [
        { type: "set", property: "sunglasses", from: false, to: true },
      ]),
      s20: originalCommit("s20", ["a10"], "Try a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "b20", style: "s20" },
  ),
  target: {
    branch: "main",
    snapshot: {
      sunglasses: true,
      hat: "none",
      scarf: "none",
      crest: "none",
    },
  },
  allowedCommands: ["log"],
  actionRequirements: [
    { type: "log", all: false },
    { type: "log", all: true },
  ],
  hints: [
    "Start with git log.",
    "The --all option reveals commits reachable from every branch.",
  ],
};

export const switchBranchesPuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-02-switch-branches",
  version: 1,
  kind: "lesson",
  slug: "switch-branches",
  title: "Switch branches",
  description:
    "Move from main to the style branch so the working view shows its turquoise scarf.",
  difficulty: "easy",
  objectives: ["Finish on the style branch.", "Reveal the scarf state stored there."],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      s20: originalCommit("s20", ["a10"], "Add a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "a10", style: "s20" },
  ),
  target: {
    branch: "style",
    snapshot: {
      sunglasses: false,
      hat: "none",
      scarf: "turquoise",
      crest: "none",
    },
  },
  allowedCommands: ["log", "switch"],
  actionRequirements: [{ type: "switch", branch: "style" }],
  hints: ["Use git switch followed by the branch name."],
};

function fastForwardRepository(): Repository {
  return repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      f20: originalCommit("f20", ["a10"], "Add a blue hat", [
        { type: "set", property: "hat", from: "none", to: "blue" },
      ]),
    },
    { main: "a10", feature: "f20" },
  );
}

const blueHatTarget = {
  sunglasses: false,
  hat: "blue",
  scarf: "none",
  crest: "none",
};

export const fastForwardMergePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-03-fast-forward-merge",
  version: 1,
  kind: "lesson",
  slug: "fast-forward-merge",
  title: "Fast-forward a branch",
  description:
    "Main has not diverged, so merge the feature branch by moving main directly to its commit.",
  difficulty: "easy",
  objectives: ["Merge feature into main.", "Keep history linear with a fast-forward."],
  initialRepository: fastForwardRepository(),
  target: {
    branch: "main",
    snapshot: blueHatTarget,
    branchHeads: { main: "f20" },
  },
  allowedCommands: ["log", "merge"],
  actionRequirements: [{ type: "merge", ffOnly: false }],
  hints: ["While on main, run git merge feature."],
};

export const ffOnlyMergePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-04-ff-only-merge",
  version: 1,
  kind: "lesson",
  slug: "ff-only-merge",
  title: "Require a fast-forward",
  description:
    "Update main only if Git can keep the history linear without creating a merge commit.",
  difficulty: "easy",
  objectives: ["Fast-forward main to feature.", "Use the --ff-only safety option."],
  initialRepository: fastForwardRepository(),
  target: {
    branch: "main",
    snapshot: blueHatTarget,
    branchHeads: { main: "f20" },
  },
  allowedCommands: ["log", "merge"],
  actionRequirements: [{ type: "merge", ffOnly: true }],
  hints: ["Add --ff-only between merge and the branch name."],
};

export const threeWayMergePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-05-three-way-merge",
  version: 1,
  kind: "lesson",
  slug: "three-way-merge",
  title: "Merge divergent work",
  description:
    "Main added a hat while feature added a scarf. Combine both independent changes in a merge commit.",
  difficulty: "medium",
  objectives: ["Inspect both branches.", "Merge feature into main without losing either change."],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      m20: originalCommit("m20", ["a10"], "Add a blue hat", [
        { type: "set", property: "hat", from: "none", to: "blue" },
      ]),
      f20: originalCommit("f20", ["a10"], "Add a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "m20", feature: "f20" },
  ),
  target: {
    branch: "main",
    snapshot: {
      sunglasses: false,
      hat: "blue",
      scarf: "turquoise",
      crest: "none",
    },
    requiredProvenance: [{ type: "merge", sourceCommit: "f20" }],
  },
  allowedCommands: ["log", "merge"],
  actionRequirements: [{ type: "merge", ffOnly: false }],
  hints: [
    "Use git log --all to inspect both lines of work.",
    "The changes touch different properties, so they can merge cleanly.",
  ],
};

export const cherryPickPuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-06-cherry-pick",
  version: 1,
  kind: "lesson",
  slug: "cherry-pick",
  title: "Copy one commit",
  description:
    "Bring only the scarf commit from the experiment branch onto main.",
  difficulty: "easy",
  objectives: ["Copy commit c20 onto main.", "Leave the experiment branch unchanged."],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      c20: originalCommit("c20", ["a10"], "Add a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "a10", experiment: "c20" },
  ),
  target: {
    branch: "main",
    snapshot: {
      sunglasses: false,
      hat: "none",
      scarf: "turquoise",
      crest: "none",
    },
    branchHeads: { experiment: "c20" },
    requiredProvenance: [{ type: "cherry-pick", sourceCommit: "c20" }],
  },
  allowedCommands: ["log", "cherry-pick"],
  actionRequirements: [{ type: "cherry-pick", commit: "c20" }],
  hints: ["Use git cherry-pick followed by the commit ID."],
};

export const revertPuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-07-revert",
  version: 1,
  kind: "lesson",
  slug: "revert",
  title: "Undo a change safely",
  description:
    "Remove the unwanted sunglasses by creating a new commit that reverses the original change.",
  difficulty: "easy",
  objectives: ["Undo commit b20 without rewriting history.", "Keep both the original and undo commits."],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      b20: originalCommit("b20", ["a10"], "Add unwanted sunglasses", [
        { type: "set", property: "sunglasses", from: false, to: true },
      ]),
    },
    { main: "b20" },
  ),
  target: {
    branch: "main",
    snapshot: emptyChicken,
    requiredProvenance: [{ type: "revert", sourceCommit: "b20" }],
  },
  allowedCommands: ["log", "revert"],
  actionRequirements: [{ type: "revert", commit: "b20" }],
  hints: ["Use git revert followed by the commit ID to create a safe undo commit."],
};

export const rebasePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-08-rebase",
  version: 1,
  kind: "lesson",
  slug: "rebase",
  title: "Replay work onto a new base",
  description:
    "Main gained a blue hat after feature started. Replay the feature's scarf commit on top of main so feature has both, without a merge commit.",
  difficulty: "easy",
  objectives: [
    "Rebase feature onto main.",
    "Keep main unchanged.",
    "Finish on feature with the hat and the scarf.",
  ],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      m20: originalCommit("m20", ["a10"], "Add a blue hat", [
        { type: "set", property: "hat", from: "none", to: "blue" },
      ]),
      f20: originalCommit("f20", ["a10"], "Add a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "m20", feature: "f20" },
    "feature",
  ),
  target: {
    branch: "feature",
    snapshot: {
      sunglasses: false,
      hat: "blue",
      scarf: "turquoise",
      crest: "none",
    },
    branchHeads: { main: "m20" },
    requiredProvenance: [{ type: "rebase", sourceCommit: "f20" }],
  },
  allowedCommands: ["log", "switch", "rebase"],
  actionRequirements: [{ type: "rebase", onto: "main" }],
  hints: [
    "You are already on feature. Rebase takes the branch to build on.",
    "Run git rebase main.",
  ],
};

export const interactiveRebasePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-09-interactive-rebase",
  version: 1,
  kind: "lesson",
  slug: "interactive-rebase",
  title: "Combine related commits",
  description:
    "Feature sketched a crest outline and then colored it red. Squash both steps into one tidy commit.",
  difficulty: "easy",
  objectives: [
    "Start an interactive rebase onto main.",
    "Pick c31 and squash c32 into it.",
    "Finish on feature with a red crest.",
  ],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      c31: originalCommit("c31", ["a10"], "Sketch a crest outline", [
        { type: "set", property: "crest", from: "none", to: "outline" },
      ]),
      c32: originalCommit("c32", ["c31"], "Color the crest red", [
        { type: "set", property: "crest", from: "outline", to: "red" },
      ]),
    },
    { main: "a10", feature: "c32" },
    "feature",
  ),
  target: {
    branch: "feature",
    snapshot: {
      sunglasses: false,
      hat: "none",
      scarf: "none",
      crest: "red",
    },
    branchHeads: { main: "a10" },
    requiredProvenance: [
      { type: "squash", sourceCommit: "c31" },
      { type: "squash", sourceCommit: "c32" },
    ],
  },
  allowedCommands: ["log", "switch", "interactive-rebase"],
  actionRequirements: [{ type: "interactive-rebase", onto: "main" }],
  hints: [
    "Run git rebase -i main to open the todo list.",
    "Keep the first commit as pick and change the second one to squash.",
  ],
};

export const capstonePuzzle: PublicPuzzleDefinition = {
  schemaVersion: PUZZLE_SCHEMA_VERSION,
  id: "basics-10-capstone",
  version: 1,
  kind: "lesson",
  slug: "capstone",
  title: "Git Basics capstone",
  description:
    "Main has unwanted sunglasses. Undo them safely, bring in the blue hat from feature, and take only the scarf from experiment, not its crest sketch.",
  difficulty: "medium",
  objectives: [
    "Undo b20 without rewriting main.",
    "Bring the blue hat from feature into main.",
    "Copy only the scarf commit from experiment.",
    "Finish on main.",
  ],
  initialRepository: repository(
    {
      a10: originalCommit("a10", [], "Start the chicken portrait"),
      b20: originalCommit("b20", ["a10"], "Add sunglasses nobody asked for", [
        { type: "set", property: "sunglasses", from: false, to: true },
      ]),
      f20: originalCommit("f20", ["a10"], "Add a blue hat", [
        { type: "set", property: "hat", from: "none", to: "blue" },
      ]),
      x20: originalCommit("x20", ["a10"], "Sketch a crest outline", [
        { type: "set", property: "crest", from: "none", to: "outline" },
      ]),
      x21: originalCommit("x21", ["x20"], "Add a turquoise scarf", [
        { type: "set", property: "scarf", from: "none", to: "turquoise" },
      ]),
    },
    { main: "b20", feature: "f20", experiment: "x21" },
  ),
  target: {
    branch: "main",
    snapshot: {
      sunglasses: false,
      hat: "blue",
      scarf: "turquoise",
      crest: "none",
    },
    requiredProvenance: [
      { type: "revert", sourceCommit: "b20" },
      { type: "cherry-pick", sourceCommit: "x21" },
    ],
  },
  allowedCommands: [
    "log",
    "switch",
    "merge",
    "cherry-pick",
    "revert",
    "rebase",
    "interactive-rebase",
  ],
  hints: [
    "Use git log --all to see every branch.",
    "Revert removes the sunglasses with a new commit.",
    "Any order works: merge or rebase the hat in, and cherry-pick only x21.",
  ],
};

export const availableLessonPuzzles = [
  inspectHistoryPuzzle,
  switchBranchesPuzzle,
  fastForwardMergePuzzle,
  ffOnlyMergePuzzle,
  threeWayMergePuzzle,
  cherryPickPuzzle,
  revertPuzzle,
  rebasePuzzle,
  interactiveRebasePuzzle,
  capstonePuzzle,
] as const satisfies readonly PublicPuzzleDefinition[];
