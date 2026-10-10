import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { linkedInService, type LinkedInStatus } from "../services/linkedin";
import { isSupabaseConfigured } from "../services/supabase";

/** Whether the player can post to LinkedIn. Asked when `enabled`, and again on log in or out. */
export function useLinkedInStatus(enabled = true) {
  const { status: authStatus } = useAuth();
  const [status, set] = useState<LinkedInStatus>(() => ({ state: isSupabaseConfigured() ? "loading" : "unavailable" }));

  useEffect(() => {
    if (!enabled || authStatus === "loading") return;
    let cancelled = false;
    void linkedInService()
      .status()
      .then((next) => {
        if (!cancelled) set(next);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, authStatus]);

  return { status, set };
}
