import {
  cherryPickPuzzle,
  fastForwardMergePuzzle,
  ffOnlyMergePuzzle,
  inspectHistoryPuzzle,
  revertPuzzle,
  switchBranchesPuzzle,
  threeWayMergePuzzle,
} from "./definitions";
import type {
  LearnBasicsLesson,
  LearnBasicsLessonId,
} from "./types";

export const learnBasicsCatalog = [
  {
    id: "basics-01-inspect-history",
    order: 1,
    title: inspectHistoryPuzzle.title,
    summary: "Read the current branch and all branch histories.",
    featuredCommands: ["git log", "git log --all"],
    status: "available",
    puzzle: inspectHistoryPuzzle,
  },
  {
    id: "basics-02-switch-branches",
    order: 2,
    title: switchBranchesPuzzle.title,
    summary: "Move HEAD safely between existing branches.",
    featuredCommands: ["git switch <branch>"],
    status: "available",
    puzzle: switchBranchesPuzzle,
  },
  {
    id: "basics-03-fast-forward-merge",
    order: 3,
    title: fastForwardMergePuzzle.title,
    summary: "Advance a branch when no histories have diverged.",
    featuredCommands: ["git merge <branch>"],
    status: "available",
    puzzle: fastForwardMergePuzzle,
  },
  {
    id: "basics-04-ff-only-merge",
    order: 4,
    title: ffOnlyMergePuzzle.title,
    summary: "Require a linear update and refuse divergent history.",
    featuredCommands: ["git merge --ff-only <branch>"],
    status: "available",
    puzzle: ffOnlyMergePuzzle,
  },
  {
    id: "basics-05-three-way-merge",
    order: 5,
    title: threeWayMergePuzzle.title,
    summary: "Combine independent changes after branches diverge.",
    featuredCommands: ["git merge <branch>"],
    status: "available",
    puzzle: threeWayMergePuzzle,
  },
  {
    id: "basics-06-cherry-pick",
    order: 6,
    title: cherryPickPuzzle.title,
    summary: "Copy one selected commit onto the current branch.",
    featuredCommands: ["git cherry-pick <commit>"],
    status: "available",
    puzzle: cherryPickPuzzle,
  },
  {
    id: "basics-07-revert",
    order: 7,
    title: revertPuzzle.title,
    summary: "Undo a change with a new history-preserving commit.",
    featuredCommands: ["git revert <commit>"],
    status: "available",
    puzzle: revertPuzzle,
  },
  {
    id: "basics-08-rebase",
    order: 8,
    title: "Replay work onto a new base",
    summary: "Rebuild a branch on top of another branch.",
    featuredCommands: ["git rebase <branch>"],
    status: "coming-soon",
    blockedBy: "rebase-engine",
  },
  {
    id: "basics-09-interactive-rebase",
    order: 9,
    title: "Combine related commits",
    summary: "Use pick and squash to clean up a short history.",
    featuredCommands: ["git rebase -i <branch>"],
    status: "coming-soon",
    blockedBy: "rebase-engine",
  },
  {
    id: "basics-10-capstone",
    order: 10,
    title: "Git Basics capstone",
    summary: "Solve a multi-command puzzle using the complete course toolkit.",
    featuredCommands: ["Multiple commands"],
    status: "coming-soon",
    blockedBy: "rebase-engine",
  },
] as const satisfies readonly LearnBasicsLesson[];

export function getLearnBasicsLesson(
  id: LearnBasicsLessonId,
): LearnBasicsLesson | undefined {
  return learnBasicsCatalog.find((lesson) => lesson.id === id);
}
