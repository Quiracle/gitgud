import type { User } from "@supabase/supabase-js";
import { requireSupabaseClient } from "./supabase";

export type OAuthProvider = "google" | "github";

export interface AuthUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  provider?: string;
}

export function toAuthUser(user: User): AuthUser {
  const metadata = user.user_metadata;
  const displayName = firstString(
    metadata.full_name,
    metadata.name,
    metadata.user_name,
    metadata.preferred_username,
  ) ?? `Player ${user.id.slice(0, 8)}`;
  const avatarUrl = firstString(metadata.avatar_url, metadata.picture);
  const provider = firstString(user.app_metadata.provider);

  return {
    id: user.id,
    displayName,
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(provider ? { provider } : {}),
  };
}

export function normalizeReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

export function oauthRedirectUrl(nextPath = "/"): string {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", normalizeReturnPath(nextPath));
  return callback.toString();
}

export async function beginOAuthSignIn(
  provider: OAuthProvider,
  nextPath = "/",
): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signInWithOAuth({
    provider,
    options: { redirectTo: oauthRedirectUrl(nextPath) },
  });
  if (error) throw error;
}

export async function finishOAuthSignIn(code: string): Promise<AuthUser> {
  const client = requireSupabaseClient();
  const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;

  const { data, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!data.user) throw new Error("The sign-in session could not be validated.");
  return toAuthUser(data.user);
}

export async function signOut(): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signOut();
  if (error) throw error;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
}
