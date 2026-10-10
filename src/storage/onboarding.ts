const WELCOME_KEY = "gitgud:welcome-seen:v1";

type FlagStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): FlagStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * Whether this browser has finished or skipped the welcome tutorial. Blocked storage
 * counts as seen, so a private window isn't shown the tutorial on every visit.
 */
export function hasSeenWelcome(storage: FlagStorage | undefined = browserStorage()): boolean {
  try {
    return !storage || storage.getItem(WELCOME_KEY) !== null;
  } catch {
    return true;
  }
}

export function markWelcomeSeen(storage: FlagStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(WELCOME_KEY, new Date().toISOString());
  } catch {
    // Nothing to remember it in; the tutorial simply may show again.
  }
}
