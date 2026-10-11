import { describe, expect, it } from "vitest";
import {
  fillCommandFromCard,
  getCommandReferenceKind,
  getCommandSuggestion,
  pickBranchReference,
} from "./commandAssist";

describe("command assistance", () => {
  it("suggests only commands available in the puzzle and prioritises rebase for git r", () => {
    expect(getCommandSuggestion("git r", ["revert", "rebase"])).toBe("git rebase");
    expect(getCommandSuggestion("git r", ["revert"])).toBe("git revert");
    expect(getCommandSuggestion("git ch", ["log", "cherry-pick"])).toBe("git cherry-pick");
    expect(getCommandSuggestion("git ch", ["log"])).toBeNull();
  });

  it("completes supported command flags without competing with card arguments", () => {
    expect(getCommandSuggestion("git merge -", ["merge"])).toBe("git merge --ff-only");
    expect(getCommandSuggestion("git rebase -", ["interactive-rebase"])).toBe("git rebase -i");
    expect(getCommandSuggestion("git r", ["interactive-rebase"])).toBe("git rebase -i");
    expect(getCommandSuggestion("git merge ", ["merge"])).toBeNull();
    expect(getCommandSuggestion("git rebase", ["rebase"])).toBeNull();
  });

  it("recognises branch and commit arguments, including command variants", () => {
    for (const command of [
      "git switch",
      "git checkout ma",
      "git merge",
      "git merge --ff-only feat",
      "git rebase",
      "git rebase -i main",
    ]) {
      expect(getCommandReferenceKind(command)).toBe("branch");
    }
    expect(getCommandReferenceKind("git cherry-pick")).toBe("commit");
    expect(getCommandReferenceKind("git revert old-id")).toBe("commit");
    expect(getCommandReferenceKind("git log")).toBeNull();
    expect(getCommandReferenceKind("git merge --squash")).toBeNull();
    expect(getCommandReferenceKind("git rebase", ["interactive-rebase"])).toBeNull();
    expect(getCommandReferenceKind("git rebase -i", ["interactive-rebase"])).toBe("branch");
  });

  it("uses a selected card's commit ID for commit-level commands", () => {
    expect(fillCommandFromCard(
      "git cherry-pick old",
      { commitId: "s14", branches: ["style"] },
      "main",
    )).toBe("git cherry-pick s14");
    expect(fillCommandFromCard(
      "Git Revert",
      { commitId: "b22", branches: [] },
      "main",
    )).toBe("Git Revert b22");
  });

  it("uses only branch-labelled cards for branch-level commands", () => {
    expect(fillCommandFromCard(
      "git merge",
      { commitId: "s14", branches: ["main", "style"] },
      "main",
    )).toBe("git merge style");
    expect(fillCommandFromCard(
      "git rebase -i old",
      { commitId: "s14", branches: ["style"] },
      "main",
    )).toBe("git rebase -i style");
    expect(fillCommandFromCard(
      "git merge",
      { commitId: "s14", branches: [] },
      "main",
    )).toBeNull();
    expect(fillCommandFromCard(
      "git rebase",
      { commitId: "s14", branches: ["main"] },
      "feature",
      ["interactive-rebase"],
    )).toBeNull();
    expect(pickBranchReference(["main", "style"], "main")).toBe("style");
  });
});
