const GUEST_KEY = "gitgud:guest-player:v1";
const MAX_SUBMITTED = 100;

type GuestStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * A guest's leaderboard identity on this device. The token is a random secret that the
 * server stores only as a hash; anyone holding it can rename or remove the guest's entries.
 */
export interface GuestPlayer {
  token: string;
  displayName?: string;
  /** Completion IDs already on a leaderboard under this guest name. */
  submitted: string[];
}

function browserStorage(): GuestStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readGuestPlayer(storage: GuestStorage | undefined = browserStorage()): GuestPlayer | undefined {
  try {
    const raw = storage?.getItem(GUEST_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<GuestPlayer>;
    if (typeof parsed.token !== "string" || parsed.token.length < 32) return undefined;
    return {
      token: parsed.token,
      ...(typeof parsed.displayName === "string" ? { displayName: parsed.displayName } : {}),
      submitted: Array.isArray(parsed.submitted) ? parsed.submitted.filter((id) => typeof id === "string") : [],
    };
  } catch {
    return undefined;
  }
}

function writeGuestPlayer(player: GuestPlayer, storage: GuestStorage | undefined): GuestPlayer {
  try {
    storage?.setItem(GUEST_KEY, JSON.stringify(player));
  } catch {
    // Without storage the name lasts for this page only; the player can enter it again.
  }
  return player;
}

/** The guest identity with this name, creating its token on first use. */
export function saveGuestName(displayName: string, storage: GuestStorage | undefined = browserStorage()): GuestPlayer {
  const existing = readGuestPlayer(storage);
  return writeGuestPlayer({ token: existing?.token ?? createGuestToken(), displayName, submitted: existing?.submitted ?? [] }, storage);
}

export function markGuestSubmitted(completionId: string, storage: GuestStorage | undefined = browserStorage()): void {
  const existing = readGuestPlayer(storage);
  if (!existing || existing.submitted.includes(completionId)) return;
  writeGuestPlayer({ ...existing, submitted: [...existing.submitted, completionId].slice(-MAX_SUBMITTED) }, storage);
}

export function clearGuestPlayer(storage: GuestStorage | undefined = browserStorage()): void {
  try {
    storage?.removeItem(GUEST_KEY);
  } catch {
    // Nothing stored to clear.
  }
}

function createGuestToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
