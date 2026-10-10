import type { GoalCheck } from "../engine";
import type { I18nValue } from "./I18nProvider";

/** A goal checklist line in the player's language, built from the check's structured spec. */
export function goalLabel(check: GoalCheck, { t, formatList }: Pick<I18nValue, "t" | "formatList">): string {
  const goal = check.goal;
  switch (goal.type) {
    case "snapshot":
      return t("goal.snapshot", { branch: goal.branch });
    case "head":
      return t("goal.head", { branch: goal.branch });
    case "branch-head":
      return t("goal.branchHead", { branch: goal.branch, commit: goal.commit });
    case "action":
      return t("goal.action", { command: goal.command });
    case "provenance": {
      const commit = goal.commits[0] ?? "";
      switch (goal.provenance) {
        case "revert":
          return t("goal.revert", { commit });
        case "merge":
          return t("goal.merge", { commit });
        case "cherry-pick":
          return t("goal.cherryPick", { commit });
        case "rebase":
          return t("goal.rebase", { commit });
        case "squash":
          return t("goal.squash", { commits: formatList(goal.commits) });
        case "original":
          return t("goal.original", { commit });
      }
    }
  }
}
