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

const DAILY_GOALS_KEY = "gitgud:daily-goals-seen:v1";

/**
 * Whether this browser has already been shown the daily goals on arrival. A daily solved
 * here before the flag existed counts too, so returning players aren't shown it again.
 */
export function hasSeenDailyGoals(
  hasCompletedDaily: () => boolean,
  storage: FlagStorage | undefined = browserStorage(),
): boolean {
  try {
    return !storage || storage.getItem(DAILY_GOALS_KEY) !== null || hasCompletedDaily();
  } catch {
    return true;
  }
}

export function markDailyGoalsSeen(storage: FlagStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(DAILY_GOALS_KEY, new Date().toISOString());
  } catch {
    // Nothing to remember it in; the goals simply may open again.
  }
}
