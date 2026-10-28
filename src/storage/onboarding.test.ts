import { describe, expect, it } from "vitest";
import { hasSeenDailyGoals, hasSeenWelcome, markDailyGoalsSeen, markWelcomeSeen } from "./onboarding";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("welcome tutorial flag", () => {
  it("shows the tutorial once, until it is finished or skipped", () => {
    const storage = new MemoryStorage();
    expect(hasSeenWelcome(storage)).toBe(false);
    markWelcomeSeen(storage);
    expect(hasSeenWelcome(storage)).toBe(true);
  });

  it("treats blocked storage as seen instead of throwing", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(hasSeenWelcome(blocked)).toBe(true);
    expect(() => markWelcomeSeen(blocked)).not.toThrow();
  });
});

describe("daily goals flag", () => {
  it("opens the goals on the first daily only", () => {
    const storage = new MemoryStorage();
    expect(hasSeenDailyGoals(() => false, storage)).toBe(false);
    markDailyGoalsSeen(storage);
    expect(hasSeenDailyGoals(() => false, storage)).toBe(true);
  });

  it("counts a daily solved before the flag existed as seen", () => {
    expect(hasSeenDailyGoals(() => true, new MemoryStorage())).toBe(true);
  });

  it("treats blocked storage as seen instead of throwing", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(hasSeenDailyGoals(() => false, blocked)).toBe(true);
    expect(() => markDailyGoalsSeen(blocked)).not.toThrow();
  });
});
