import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  beginOAuthSignIn,
  signOut as signOutFromSupabase,
  toAuthUser,
  type AuthUser,
  type OAuthProvider,
} from "../services/auth";
import { t } from "../i18n/runtime";
import { getSupabaseClient, isSupabaseConfigured } from "../services/supabase";

type AuthStatus = "loading" | "guest" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  configured: boolean;
  user?: AuthUser;
  error?: string;
  pendingProvider?: OAuthProvider;
  signIn: (provider: OAuthProvider, nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [status, setStatus] = useState<AuthStatus>(configured ? "loading" : "guest");
  const [user, setUser] = useState<AuthUser>();
  const [error, setError] = useState<string>();
  const [pendingProvider, setPendingProvider] = useState<OAuthProvider>();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(t("auth.sessionFailed"));
      setUser(data.session?.user ? toAuthUser(data.session.user) : undefined);
      setStatus(data.session ? "authenticated" : "guest");
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : undefined);
      setStatus(session ? "authenticated" : "guest");
      setPendingProvider(undefined);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      configured,
      user,
      error,
      pendingProvider,
      async signIn(provider, nextPath) {
        setError(undefined);
        setPendingProvider(provider);
        try {
          await beginOAuthSignIn(provider, nextPath);
        } catch (reason) {
          setPendingProvider(undefined);
          console.warn(reason);
          setError(t("auth.signInFailed"));
        }
      },
      async signOut() {
        setError(undefined);
        try {
          await signOutFromSupabase();
        } catch (reason) {
          console.warn(reason);
          setError(t("auth.signOutFailed"));
        }
      },
      clearError: () => setError(undefined),
    }),
    [configured, error, pendingProvider, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
