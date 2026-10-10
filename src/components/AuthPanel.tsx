import { useAuth } from "../context/AuthContext";

export function AuthPanel() {
  const { configured, error, pendingProvider, status, user, clearError, signIn, signOut } =
    useAuth();

  if (status === "authenticated" && user) {
    return (
      <section className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full border border-cyan-200/40 object-cover"
            />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-cyan-300 font-black text-cyan-950">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Signed in{user.provider ? ` with ${user.provider}` : ""}
            </p>
            <p className="truncate text-lg font-bold text-white">{user.displayName}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="min-h-11 rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:border-slate-400"
          >
            Sign out
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          This account will own your synced progress and leaderboard results.
        </p>
        <AuthError message={error} onDismiss={clearError} />
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Optional account</p>
      <h2 className="mt-3 text-2xl font-black">Save progress and join the leaderboard</h2>
      <p className="mt-2 text-slate-300">
        You can keep playing as a guest. Sign in when you want progress synced across devices or a
        daily result ranked.
      </p>

      {configured ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <SignInButton
            label="Continue with Google"
            busy={pendingProvider === "google"}
            disabled={status === "loading" || Boolean(pendingProvider)}
            onClick={() => void signIn("google")}
          />
          <SignInButton
            label="Continue with GitHub"
            busy={pendingProvider === "github"}
            disabled={status === "loading" || Boolean(pendingProvider)}
            onClick={() => void signIn("github")}
          />
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          Login is not configured in this environment. Guest play is still available.
        </p>
      )}

      <AuthError message={error} onDismiss={clearError} />
    </section>
  );
}

function SignInButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 flex-1 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Opening provider…" : label}
    </button>
  );
}

function AuthError({ message, onDismiss }: { message?: string; onDismiss: () => void }) {
  if (!message) return null;
  return (
    <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm text-rose-100">
      <p>{message}</p>
      <button type="button" onClick={onDismiss} className="font-bold" aria-label="Dismiss error">
        ×
      </button>
    </div>
  );
}
