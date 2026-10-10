import type { SupabaseClient } from "@supabase/supabase-js";
import { t } from "../i18n/runtime";
import type { TranslationKey } from "../i18n/translate";
import { normalizeReturnPath } from "./auth";
import { getSupabaseClient } from "./supabase";

/**
 * Posting result cards to LinkedIn. The browser only talks to the linkedin-share Edge
 * Function, which owns the LinkedIn client secret and the member's access token.
 */
export type LinkedInStatus =
  /** Still asking the Edge Function. */
  | { state: "loading" }
  /** Supabase or the LinkedIn app isn't configured: fall back to share sheet and copy. */
  | { state: "unavailable" }
  /** Guests can't hold a LinkedIn connection; they log in first. */
  | { state: "signed-out" }
  | { state: "disconnected"; expired?: boolean }
  | { state: "connected"; name?: string };

export interface LinkedInPost {
  puzzleId: string;
  puzzleVersion: number;
  text: string;
  image: Blob;
}

export interface LinkedInService {
  status(): Promise<LinkedInStatus>;
  /** Sends the browser to LinkedIn's consent screen; it comes back to /linkedin/callback. */
  connect(returnPath: string): Promise<void>;
  finish(code: string, state: string): Promise<{ returnPath: string }>;
  post(post: LinkedInPost): Promise<{ postUrl: string }>;
  disconnect(): Promise<void>;
}

/** A failure the share dialog can show as-is. `code` tells it what to offer next. */
export class LinkedInError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export const LINKEDIN_CALLBACK_PATH = "/linkedin/callback";

/** Remembers which result to reopen the share dialog for after the LinkedIn round trip. */
const RESUME_KEY = "gitgud:linkedin:resume-share";

export function rememberShareToResume(puzzleKey: string) {
  try {
    sessionStorage.setItem(RESUME_KEY, puzzleKey);
  } catch {
    // Without storage the dialog just stays closed after returning.
  }
}

/** Returns true once for the matching result, then forgets it. */
export function takeShareToResume(puzzleKey: string): boolean {
  try {
    if (sessionStorage.getItem(RESUME_KEY) !== puzzleKey) return false;
    sessionStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

export class SupabaseLinkedInService implements LinkedInService {
  constructor(private readonly client: SupabaseClient) {}

  async status(): Promise<LinkedInStatus> {
    const { data: session } = await this.client.auth.getSession();
    if (!session.session) return { state: "signed-out" };
    try {
      const data = await this.call({ action: "status" });
      if (!data?.configured) return { state: "unavailable" };
      return data.connected
        ? { state: "connected", name: typeof data.name === "string" ? data.name : undefined }
        : { state: "disconnected", expired: data.expired === true };
    } catch {
      return { state: "unavailable" };
    }
  }

  async connect(returnPath: string): Promise<void> {
    const data = await this.call({
      action: "start",
      returnPath: normalizeReturnPath(returnPath),
      redirectUri: new URL(LINKEDIN_CALLBACK_PATH, window.location.origin).toString(),
    });
    if (typeof data?.url !== "string" || !data.url.startsWith("https://www.linkedin.com/")) {
      throw new LinkedInError(t("linkedin.error.openFailed"));
    }
    window.location.assign(data.url);
  }

  async finish(code: string, state: string): Promise<{ returnPath: string }> {
    const data = await this.call({ action: "finish", code, state });
    return { returnPath: normalizeReturnPath(data?.returnPath) };
  }

  async post({ puzzleId, puzzleVersion, text, image }: LinkedInPost): Promise<{ postUrl: string }> {
    const data = await this.call({ action: "post", puzzleId, puzzleVersion, text, image: await toBase64(image) });
    if (typeof data?.postUrl !== "string" || !data.postUrl.startsWith("https://www.linkedin.com/")) {
      throw new LinkedInError(t("linkedin.error.unconfirmed"));
    }
    return { postUrl: data.postUrl };
  }

  async disconnect(): Promise<void> {
    await this.call({ action: "disconnect" });
  }

  private async call(body: Record<string, unknown>) {
    const { data, error } = await this.client.functions.invoke("linkedin-share", { body });
    if (error) throw await friendlyError(error);
    return data;
  }
}

/** Without Supabase there is nothing to connect to. */
export class UnavailableLinkedInService implements LinkedInService {
  async status(): Promise<LinkedInStatus> {
    return { state: "unavailable" };
  }
  async connect(): Promise<void> {
    throw new LinkedInError(t("linkedin.error.unavailable"), "unavailable");
  }
  async finish(): Promise<{ returnPath: string }> {
    throw new LinkedInError(t("linkedin.error.unavailable"), "unavailable");
  }
  async post(): Promise<{ postUrl: string }> {
    throw new LinkedInError(t("linkedin.error.unavailable"), "unavailable");
  }
  async disconnect(): Promise<void> {}
}

let service: LinkedInService | undefined;

export function linkedInService(): LinkedInService {
  if (!service) {
    const client = getSupabaseClient();
    service = client ? new SupabaseLinkedInService(client) : new UnavailableLinkedInService();
  }
  return service;
}

/** The Edge Function's error codes, phrased in the player's language. */
const ERROR_MESSAGES: Record<string, TranslationKey> = {
  signed_out: "linkedin.error.signedOut",
  unavailable: "linkedin.error.unavailable",
  not_connected: "linkedin.error.notConnected",
  rate_limited: "linkedin.error.rateLimited",
  invalid_text: "linkedin.error.invalidText",
  invalid_image: "linkedin.error.invalidImage",
  invalid_request: "linkedin.error.generic",
  invalid_callback: "linkedin.callback.invalid",
  invalid_state: "linkedin.error.expiredState",
  missing_scope: "linkedin.error.missingScope",
  redirect_not_allowed: "linkedin.error.redirect",
};

/** The Edge Function answers errors with `{ error, code }`; the code picks the message. */
async function friendlyError(error: { context?: unknown }): Promise<LinkedInError> {
  const context = error.context;
  if (context instanceof Response) {
    let code: string | undefined;
    try {
      const body = await context.clone().json();
      if (typeof body?.code === "string") code = body.code;
    } catch {
      // No body: decide from the status alone.
    }
    if (!code && context.status === 401) code = "signed_out";
    if (code && ERROR_MESSAGES[code]) return new LinkedInError(t(ERROR_MESSAGES[code]), code);
    return new LinkedInError(t("linkedin.error.generic"), code);
  }
  return new LinkedInError(t("linkedin.error.offline"));
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
