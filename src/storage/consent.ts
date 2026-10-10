export const CONSENT_KEY = "gitgud:consent:v1";
/** The AEPD recommends asking again at most 24 months after a choice. */
export const CONSENT_MAX_AGE_MS = 730 * 24 * 60 * 60 * 1000;

export interface ConsentRecord {
  analytics: boolean;
  decidedAt: string;
}

type ConsentStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): ConsentStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The visitor's cookie choice, or undefined when they haven't chosen, the choice has
 * expired, or it can't be read. Anything undefined means analytics stays off.
 */
export function readConsent(storage: ConsentStorage | undefined = browserStorage(), now = Date.now()): ConsentRecord | undefined {
  try {
    const raw = storage?.getItem(CONSENT_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<ConsentRecord>;
    const decidedAt = Date.parse(value.decidedAt ?? "");
    if (typeof value.analytics !== "boolean" || Number.isNaN(decidedAt)) return undefined;
    if (now - decidedAt > CONSENT_MAX_AGE_MS || decidedAt > now) return undefined;
    return { analytics: value.analytics, decidedAt: value.decidedAt! };
  } catch {
    return undefined;
  }
}

export function writeConsent(
  analytics: boolean,
  storage: ConsentStorage | undefined = browserStorage(),
  now = Date.now(),
): ConsentRecord {
  const record: ConsentRecord = { analytics, decidedAt: new Date(now).toISOString() };
  try {
    storage?.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // Blocked storage: the choice holds for this visit and is asked again next time.
  }
  return record;
}
