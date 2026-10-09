import type { LearnBasicsLessonId } from "./types";

/**
 * Test/publication metadata only. Do not export this module from the runtime
 * catalog barrel or send it with player-facing lesson definitions.
 */
export const learnBasicsSolutions: Partial<
  Record<LearnBasicsLessonId, readonly string[]>
> = {
  "basics-01-inspect-history": ["git log", "git log --all"],
  "basics-02-switch-branches": ["git switch style"],
  "basics-03-fast-forward-merge": ["git merge feature"],
  "basics-04-ff-only-merge": ["git merge --ff-only feature"],
  "basics-05-three-way-merge": ["git log --all", "git merge feature"],
  "basics-06-cherry-pick": ["git cherry-pick c20"],
  "basics-07-revert": ["git revert b20"],
  "basics-08-rebase": ["git rebase main"],
  "basics-09-interactive-rebase": ["git rebase -i main\npick c31\nsquash c32"],
  "basics-10-capstone": [
    "git revert b20",
    "git merge feature",
    "git cherry-pick x21",
  ],
};
