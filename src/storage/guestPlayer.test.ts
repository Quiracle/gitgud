import { describe, expect, it } from "vitest";
import { clearGuestPlayer, markGuestSubmitted, readGuestPlayer, saveGuestName } from "./guestPlayer";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("guest leaderboard identity", () => {
  it("creates a random token once and keeps it when the name changes", () => {
    const storage = new MemoryStorage();
    expect(readGuestPlayer(storage)).toBeUndefined();

    const first = saveGuestName("pixelhen", storage);
    expect(first.token).toMatch(/^[0-9a-f]{64}$/);
    const renamed = saveGuestName("rebase_queen", storage);
    expect(renamed).toEqual({ token: first.token, displayName: "rebase_queen", submitted: [] });
    expect(saveGuestName("other", new MemoryStorage()).token).not.toBe(first.token);
  });

  it("remembers which solves joined a leaderboard, once each", () => {
    const storage = new MemoryStorage();
    saveGuestName("pixelhen", storage);
    markGuestSubmitted("attempt-1", storage);
    markGuestSubmitted("attempt-1", storage);
    markGuestSubmitted("attempt-2", storage);
    expect(readGuestPlayer(storage)?.submitted).toEqual(["attempt-1", "attempt-2"]);
  });

  it("ignores damaged data and forgets the guest when cleared", () => {
    const storage = new MemoryStorage();
    storage.setItem("gitgud:guest-player:v1", "{not json");
    expect(readGuestPlayer(storage)).toBeUndefined();
    storage.setItem("gitgud:guest-player:v1", JSON.stringify({ token: "short" }));
    expect(readGuestPlayer(storage)).toBeUndefined();

    saveGuestName("pixelhen", storage);
    clearGuestPlayer(storage);
    expect(readGuestPlayer(storage)).toBeUndefined();
  });

  it("does nothing without storage", () => {
    expect(() => saveGuestName("pixelhen", undefined)).not.toThrow();
    expect(readGuestPlayer(undefined)).toBeUndefined();
  });
});
