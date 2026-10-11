import { describe, expect, it } from "vitest";
import {
  fillCommandFromCard,
  getCommandReferenceKind,
  getCommandSuggestion,
  pickBranchReference,
} from "./commandAssist";

describe("command assistance", () => {
  it("suggests a globally supported command only when the prefix is unambiguous", () => {
    expect(getCommandSuggestion("git")).toBeNull();
    expect(getCommandSuggestion("git ")).toBeNull();
    expect(getCommandSuggestion("git r")).toBeNull();
    expect(getCommandSuggestion("git re")).toBeNull();
    expect(getCommandSuggestion("git reb")).toBe("git rebase");
    expect(getCommandSuggestion("git rev")).toBe("git revert");
    expect(getCommandSuggestion("git ch")).toBe("git cherry-pick");
    expect(getCommandSuggestion("git unknown")).toBeNull();
  });

  it("completes supported command flags without competing with card arguments", () => {
    expect(getCommandSuggestion("git merge -")).toBe("git merge --ff-only");
    expect(getCommandSuggestion("git rebase -")).toBe("git rebase -i");
    expect(getCommandSuggestion("git merge ")).toBeNull();
    expect(getCommandSuggestion("git rebase")).toBeNull();
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
    expect(pickBranchReference(["main", "style"], "main")).toBe("style");
  });
});
