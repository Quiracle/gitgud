import { describe, expect, it } from "vitest";
import { commandAchievements, learnedCommandOf, mergeLearned, newlyLearned } from "./learnedCommands";

describe("learnedCommandOf", () => {
  it("names the command whatever its arguments", () => {
    expect(learnedCommandOf("git revert blablabla")).toBe("revert");
    expect(learnedCommandOf("  GIT Cherry-Pick s14 ")).toBe("cherry-pick");
    expect(learnedCommandOf("git merge --ff-only feature")).toBe("merge");
    expect(learnedCommandOf("git log --all")).toBe("log");
    expect(learnedCommandOf("git rebase")).toBe("rebase");
  });

  it("treats checkout as switch and rebase -i as its own command", () => {
    expect(learnedCommandOf("git checkout main")).toBe("switch");
    expect(learnedCommandOf("git rebase -i main\npick a1\nsquash a2")).toBe("interactive-rebase");
    expect(learnedCommandOf("git rebase --interactive main")).toBe("interactive-rebase");
  });

  it("ignores unsupported or non-Git lines", () => {
    expect(learnedCommandOf("git commit -m hi")).toBeUndefined();
    expect(learnedCommandOf("git")).toBeUndefined();
    expect(learnedCommandOf("ls")).toBeUndefined();
    expect(learnedCommandOf("")).toBeUndefined();
  });
});

describe("learned command sets", () => {
  it("keeps the earliest time for each command", () => {
    expect(
      mergeLearned({ log: "2026-10-02T00:00:00.000Z" }, { log: "2026-10-01T00:00:00.000Z", revert: "2026-10-03T00:00:00.000Z" }),
    ).toEqual({ log: "2026-10-01T00:00:00.000Z", revert: "2026-10-03T00:00:00.000Z" });
  });

  it("lists every command, locked ones included, and reports new ones", () => {
    const list = commandAchievements({ revert: "2026-10-03T00:00:00.000Z" }, { revert: 4 });
    expect(list.find((item) => item.id === "revert")?.timesTyped).toBe(4);
    expect(commandAchievements({ log: "x" })[0].timesTyped).toBe(1);
    expect(list).toHaveLength(7);
    expect(list.filter((item) => item.unlocked).map((item) => item.id)).toEqual(["revert"]);
    expect(newlyLearned({ log: "x" }, { log: "x", merge: "y" })).toEqual(["merge"]);
  });
});
