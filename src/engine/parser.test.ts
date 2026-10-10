import { describe, expect, it } from "vitest";
import { parseGitCommand } from "./parser";

describe("parseGitCommand", () => {
  it("parses every MVP command into a typed action", () => {
    expect(parseGitCommand("git log")).toEqual({
      ok: true,
      action: { type: "log", all: false },
    });
    expect(parseGitCommand("git log --all")).toEqual({
      ok: true,
      action: { type: "log", all: true },
    });
    expect(parseGitCommand("git switch style")).toEqual({
      ok: true,
      action: { type: "switch", branch: "style" },
    });
    expect(parseGitCommand("git checkout main")).toEqual({
      ok: true,
      action: { type: "switch", branch: "main" },
    });
    expect(parseGitCommand("git merge style")).toEqual({
      ok: true,
      action: { type: "merge", branch: "style", ffOnly: false },
    });
    expect(parseGitCommand("git merge --ff-only style")).toEqual({
      ok: true,
      action: { type: "merge", branch: "style", ffOnly: true },
    });
    expect(parseGitCommand("git cherry-pick s14")).toEqual({
      ok: true,
      action: { type: "cherry-pick", commit: "s14" },
    });
    expect(parseGitCommand("git revert b22")).toEqual({
      ok: true,
      action: { type: "revert", commit: "b22" },
    });
  });

  it("rejects arbitrary and explicitly unsupported input", () => {
    expect(parseGitCommand("rm -rf repo")).toMatchObject({ ok: false });
    expect(parseGitCommand("git reset --hard")).toEqual({
      ok: false,
      error: "`git reset` is not part of this puzzle simulator.",
    });
    expect(parseGitCommand("git merge --squash style")).toMatchObject({
      ok: false,
    });
    expect(parseGitCommand("git log --graph")).toEqual({
      ok: false,
      error: "This simulator supports `git log` and `git log --all`.",
    });
  });

  it("accepts capitalized Git syntax from mobile keyboards", () => {
    expect(parseGitCommand("Git Log --ALL")).toEqual({
      ok: true,
      action: { type: "log", all: true },
    });
    expect(parseGitCommand("GIT MERGE --FF-ONLY style")).toEqual({
      ok: true,
      action: { type: "merge", branch: "style", ffOnly: true },
    });
    expect(parseGitCommand("Git Cherry-Pick s14")).toEqual({
      ok: true,
      action: { type: "cherry-pick", commit: "s14" },
    });
  });

  it("preserves branch and commit casing while normalizing Git syntax", () => {
    expect(parseGitCommand("Git Switch Feature/ChickenHat")).toEqual({
      ok: true,
      action: { type: "switch", branch: "Feature/ChickenHat" },
    });
    expect(parseGitCommand("Git Revert B22")).toEqual({
      ok: true,
      action: { type: "revert", commit: "B22" },
    });
  });
});
