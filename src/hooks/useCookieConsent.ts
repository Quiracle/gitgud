import { useSyncExternalStore } from "react";
import { disableAnalytics, enableAnalytics } from "../services/analytics";
import { readConsent, writeConsent, type ConsentRecord } from "../storage/consent";

interface ConsentState {
  record?: ConsentRecord;
  /** The player reopened the banner from Cookie settings. */
  reviewing: boolean;
}

let state: ConsentState = { record: readConsent(), reviewing: false };
const listeners = new Set<() => void>();

function update(next: ConsentState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Applies a choice saved on an earlier visit. Call once at startup. */
export function startAnalyticsIfConsented(): void {
  if (state.record?.analytics) enableAnalytics();
}

export function decideCookies(analytics: boolean): void {
  if (analytics) enableAnalytics();
  else disableAnalytics();
  update({ record: writeConsent(analytics), reviewing: false });
}

export function openCookieSettings(): void {
  update({ ...state, reviewing: true });
}

/** The visitor's cookie choice, and whether the banner should be showing. */
export function useCookieConsent() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
  return {
    analytics: current.record?.analytics,
    bannerOpen: !current.record || current.reviewing,
  };
}
