import { describe, expect, it } from "vitest";
import { CONSENT_KEY, CONSENT_MAX_AGE_MS, readConsent, writeConsent } from "./consent";

function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("cookie consent", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");

  it("has no choice until the visitor makes one", () => {
    expect(readConsent(memory(), now)).toBeUndefined();
  });

  it("remembers acceptance and rejection", () => {
    const storage = memory();
    writeConsent(true, storage, now);
    expect(readConsent(storage, now)).toEqual({ analytics: true, decidedAt: "2026-10-10T12:00:00.000Z" });
    writeConsent(false, storage, now);
    expect(readConsent(storage, now)?.analytics).toBe(false);
  });

  it("asks again once a choice is older than 24 months", () => {
    const storage = memory();
    writeConsent(true, storage, now);
    expect(readConsent(storage, now + CONSENT_MAX_AGE_MS)).toBeDefined();
    expect(readConsent(storage, now + CONSENT_MAX_AGE_MS + 1)).toBeUndefined();
  });

  it("treats corrupt or blocked storage as no choice, so analytics stays off", () => {
    const storage = memory();
    storage.values.set(CONSENT_KEY, "{not json");
    expect(readConsent(storage, now)).toBeUndefined();
    storage.values.set(CONSENT_KEY, JSON.stringify({ analytics: "yes", decidedAt: "2026-10-10" }));
    expect(readConsent(storage, now)).toBeUndefined();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readConsent(blocked, now)).toBeUndefined();
    expect(writeConsent(true, blocked, now).analytics).toBe(true);
  });
});
