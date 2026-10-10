/** Google Analytics 4 property. Public by design: it ships in every page view. */
export const GA_MEASUREMENT_ID = "G-BFBC4GRELH";

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let loaded = false;

/**
 * Loads Google Analytics. Call only after the visitor accepts analytics cookies;
 * nothing from Google is requested before that. Skipped in development builds.
 */
export function enableAnalytics(): void {
  if (!import.meta.env.PROD) return;
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (loaded) {
    window.gtag?.("consent", "update", { analytics_storage: "granted" });
    return;
  }
  loaded = true;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag() {
    // gtag.js reads the arguments object itself, not an array.
    window.dataLayer!.push(arguments);
  };
  // Advertising stays off whatever the visitor chose; only measurement is granted.
  window.gtag("consent", "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Stops measurement and deletes the cookies Google Analytics set. */
export function disableAnalytics(): void {
  (window as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  if (loaded) window.gtag?.("consent", "update", { analytics_storage: "denied" });
  for (const name of analyticsCookieNames(document.cookie)) {
    for (const domain of cookieDomains(window.location.hostname)) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

export function analyticsCookieNames(cookies: string): string[] {
  return cookies
    .split(";")
    .map((cookie) => cookie.split("=")[0].trim())
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
}

/** Google sets its cookies on the widest domain it can, so clear every candidate. */
export function cookieDomains(hostname: string): string[] {
  const parts = hostname.split(".");
  const domains = [""];
  for (let index = 0; index < parts.length - 1; index += 1) domains.push(`.${parts.slice(index).join(".")}`);
  return domains;
}
