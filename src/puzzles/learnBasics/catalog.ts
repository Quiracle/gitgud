import {
  capstonePuzzle,
  cherryPickPuzzle,
  fastForwardMergePuzzle,
  ffOnlyMergePuzzle,
  inspectHistoryPuzzle,
  interactiveRebasePuzzle,
  rebasePuzzle,
  revertPuzzle,
  switchBranchesPuzzle,
  threeWayMergePuzzle,
} from "./definitions";
import type {
  LearnBasicsLesson,
  LearnBasicsLessonId,
} from "./types";

export const learnBasicsCatalog: readonly LearnBasicsLesson[] = [
  {
    id: "basics-01-inspect-history",
    order: 1,
    title: inspectHistoryPuzzle.title,
    summary: "Read the current branch and all branch histories.",
    featuredCommands: ["git log", "git log --all"],
    status: "available",
    intro: {
      what: "Every commit is a saved snapshot of the project. git log lists them, newest first, so you can see how the project got here.",
      how: [
        "git log starts at HEAD, the commit you're on, and follows each commit back to its parent.",
        "Commits that only live on other branches are hidden, because your branch can't reach them.",
        "Add --all to list the commits of every branch at once.",
      ],
      task: "Run git log, then git log --all to find the scarf work hiding on another branch.",
    },
    puzzle: inspectHistoryPuzzle,
  },
  {
    id: "basics-02-switch-branches",
    order: 2,
    title: switchBranchesPuzzle.title,
    summary: "Move HEAD safely between existing branches.",
    featuredCommands: ["git switch <branch>"],
    status: "available",
    intro: {
      what: "A branch is a name that points at a commit. git switch moves HEAD, your current position, to another branch so you see its version of the project.",
      how: [
        "HEAD is where you are. It's the card with the lime outline.",
        "git switch style moves HEAD to style and shows the chicken saved there.",
        "Nothing is lost: main still points at its own commit, and you can switch back anytime.",
        "git checkout <branch> also works, but switch is the clearer, modern command.",
      ],
      task: "Switch from main to the style branch to reveal the turquoise scarf.",
    },
    puzzle: switchBranchesPuzzle,
  },
  {
    id: "basics-03-fast-forward-merge",
    order: 3,
    title: fastForwardMergePuzzle.title,
    summary: "Advance a branch when no histories have diverged.",
    featuredCommands: ["git merge <branch>"],
    status: "available",
    intro: {
      what: "git merge brings another branch's work into the branch you're on.",
      how: [
        "If your branch hasn't moved since the other one split off, there's nothing to combine.",
        "Git just slides your branch forward to the other branch's latest commit. That's a fast-forward.",
        "No new commit is made, so history stays a straight line.",
      ],
      task: "You're on main. Merge feature to give the chicken its blue hat.",
    },
    puzzle: fastForwardMergePuzzle,
  },
  {
    id: "basics-04-ff-only-merge",
    order: 4,
    title: ffOnlyMergePuzzle.title,
    summary: "Require a linear update and refuse divergent history.",
    featuredCommands: ["git merge --ff-only <branch>"],
    status: "available",
    intro: {
      what: "--ff-only tells git merge: fast-forward if you can, otherwise do nothing.",
      how: [
        "When a fast-forward is possible, it works exactly like a normal merge.",
        "When the branches have diverged, Git refuses instead of making a merge commit.",
        "Teams use it to keep history linear and avoid surprise merge commits.",
      ],
      task: "Fast-forward main to feature with git merge --ff-only feature.",
    },
    puzzle: ffOnlyMergePuzzle,
  },
  {
    id: "basics-05-three-way-merge",
    order: 5,
    title: threeWayMergePuzzle.title,
    summary: "Combine independent changes after branches diverge.",
    featuredCommands: ["git merge <branch>"],
    status: "available",
    intro: {
      what: "When both branches have new commits, Git can't just slide forward. It makes a merge commit that joins the two lines of work.",
      how: [
        "Git finds the common ancestor, the commit where the branches split.",
        "It combines what changed on each side since that point.",
        "The result is a new merge commit with two parents, one from each branch.",
        "If both sides change the same thing, that's a conflict. Conflicts aren't supported here.",
      ],
      task: "Main added a hat and feature added a scarf. Merge feature into main to keep both.",
    },
    puzzle: threeWayMergePuzzle,
  },
  {
    id: "basics-06-cherry-pick",
    order: 6,
    title: cherryPickPuzzle.title,
    summary: "Copy one selected commit onto the current branch.",
    featuredCommands: ["git cherry-pick <commit>"],
    status: "available",
    intro: {
      what: "git cherry-pick copies one commit from anywhere in the graph onto your current branch.",
      how: [
        "Give it a commit ID, like c20. Every card shows its ID.",
        "Git applies only that commit's change on top of HEAD, as a brand-new commit.",
        "The original commit stays where it was, so its branch doesn't change.",
        "It's handy when you need one change without the rest of a branch.",
      ],
      task: "Copy the scarf commit c20 from experiment onto main.",
    },
    puzzle: cherryPickPuzzle,
  },
  {
    id: "basics-07-revert",
    order: 7,
    title: revertPuzzle.title,
    summary: "Undo a change with a new history-preserving commit.",
    featuredCommands: ["git revert <commit>"],
    status: "available",
    intro: {
      what: "git revert undoes a commit by adding a new commit that does the exact opposite.",
      how: [
        "Give it the ID of the commit you want to undo.",
        "Git works out the reverse change (sunglasses on becomes sunglasses off) and commits it.",
        "The original commit stays in history, so nothing is rewritten.",
        "That makes revert safe on branches other people share.",
      ],
      task: "Take off the sunglasses by reverting commit b20.",
    },
    puzzle: revertPuzzle,
  },
  {
    id: "basics-08-rebase",
    order: 8,
    title: rebasePuzzle.title,
    summary: "Rebuild a branch on top of another branch.",
    featuredCommands: ["git rebase <branch>"],
    status: "available",
    intro: {
      what: "git rebase moves your branch so it starts from the tip of another branch, as if you had started your work there.",
      how: [
        "Git sets aside the commits that are only on your branch.",
        "It moves your branch to the tip of the branch you name.",
        "Then it replays your commits on top, one by one, as new commits.",
        "History stays a straight line with no merge commit, and the other branch doesn't move.",
      ],
      task: "You're on feature. Rebase it onto main so it has both the hat and the scarf.",
    },
    puzzle: rebasePuzzle,
  },
  {
    id: "basics-09-interactive-rebase",
    order: 9,
    title: interactiveRebasePuzzle.title,
    summary: "Use pick and squash to clean up a short history.",
    featuredCommands: ["git rebase -i <branch>"],
    status: "available",
    intro: {
      what: "Interactive rebase lets you edit the list of commits before Git replays them.",
      how: [
        "git rebase -i <branch> opens a to-do list of your branch's commits, oldest first.",
        "pick keeps a commit as it is.",
        "squash melts a commit into the one above it, so their changes become one commit.",
        "Git then replays the list, leaving a tidier history.",
      ],
      task: "Run git rebase -i main, keep c31 as pick and squash c32 into it.",
    },
    puzzle: interactiveRebasePuzzle,
  },
  {
    id: "basics-10-capstone",
    order: 10,
    title: capstonePuzzle.title,
    summary: "Solve a multi-command puzzle using the complete course toolkit.",
    featuredCommands: ["git log --all", "git revert <commit>", "git merge <branch>", "git cherry-pick <commit>"],
    status: "available",
    intro: {
      what: "Time to put it all together. There's no single right answer: any commands that reach the goal will do.",
      how: [
        "Start with git log --all to explore every branch.",
        "revert removes an unwanted change safely.",
        "merge (or rebase) brings in a whole branch.",
        "cherry-pick takes just one commit.",
      ],
      task: "On main: undo the sunglasses, bring in the blue hat from feature, and copy only the scarf from experiment.",
    },
    puzzle: capstonePuzzle,
  },
];

export function getLearnBasicsLesson(
  id: LearnBasicsLessonId,
): LearnBasicsLesson | undefined {
  return learnBasicsCatalog.find((lesson) => lesson.id === id);
}
