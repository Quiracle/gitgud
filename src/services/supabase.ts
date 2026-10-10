import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getSupabaseClient(): SupabaseClient | undefined {
  if (!isSupabaseConfigured()) return undefined;

  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        storageKey: "gitgud:auth:v1",
      },
    },
  );

  return client;
}

export function requireSupabaseClient(): SupabaseClient {
  const configuredClient = getSupabaseClient();
  if (!configuredClient) {
    throw new Error("Supabase is not configured. You can continue playing as a guest.");
  }
  return configuredClient;
}
