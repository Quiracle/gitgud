import { requireSupabaseClient } from "./supabase";

export const DISPLAY_NAME_MAX = 40;

/** The signed-in player's public leaderboard name (RLS limits this to their own row). */
export async function getDisplayName(userId: string): Promise<string | undefined> {
  const { data, error } = await requireSupabaseClient()
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Profile is unavailable: ${error.message}`);
  return typeof data?.display_name === "string" ? data.display_name : undefined;
}

export async function updateDisplayName(userId: string, name: string): Promise<string> {
  const displayName = name.trim().slice(0, DISPLAY_NAME_MAX);
  if (!displayName) throw new Error("Pick a name with at least one character.");
  const { error } = await requireSupabaseClient()
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error(`Couldn't save your name: ${error.message}`);
  return displayName;
}
