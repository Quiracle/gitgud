import { LocalProgressStore } from "./progress";

const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
};

/** Event fired after progress changes so other screens can refresh. */
export const PROGRESS_CHANGED = "gitgud:progress-changed";

/**
 * The browser's progress store. Falls back to memory when localStorage is blocked
 * (some private modes throw on access), so play never breaks.
 */
export function openProgressStore(): LocalProgressStore {
  let storage: Pick<Storage, "getItem" | "setItem"> = memoryStorage;
  try {
    window.localStorage.getItem("gitgud:probe");
    storage = window.localStorage;
  } catch {
    // Keep the in-memory fallback.
  }
  return new LocalProgressStore({
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => {
      storage.setItem(key, value);
      window.dispatchEvent(new Event(PROGRESS_CHANGED));
    },
  });
}
