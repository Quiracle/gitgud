import { describe, expect, it } from "vitest";
import { hasSeenWelcome, markWelcomeSeen } from "./onboarding";

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
