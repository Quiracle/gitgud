import { useEffect, useRef, useState } from "react";
import { Button } from "../components/Button/Button";
import { linkedInService } from "../services/linkedin";

interface LinkedInCallbackScreenProps {
  onNavigate: (path: string) => void;
  onReplace: (path: string) => void;
}

/** LinkedIn sends the player back here after the consent screen; the Edge Function stores the connection. */
export function LinkedInCallbackScreen({ onNavigate, onReplace }: LinkedInCallbackScreenProps) {
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const providerError = params.get("error");

    if (providerError) {
      // Cancelling on LinkedIn is a choice, not a failure worth a message.
      setError(
        providerError.startsWith("user_cancelled")
          ? "You didn't connect LinkedIn. You can still copy or download your result."
          : "LinkedIn couldn't connect. Please try again.",
      );
      return;
    }
    if (!code || !state) {
      setError("LinkedIn didn't send back a valid connection. Please try again.");
      return;
    }

    void linkedInService()
      .finish(code, state)
      .then(({ returnPath }) => onReplace(returnPath))
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "LinkedIn couldn't connect. Please try again.");
      });
  }, [onReplace]);

  return (
    <main className="grid min-h-dvh place-items-center bg-green-950 px-6 text-grey-50">
      <section className="flex w-full max-w-[327px] flex-col gap-6 rounded border border-lime-400 p-6" aria-live="polite">
        <h1 className="text-xl leading-[25px]">{error ? "LinkedIn isn't connected" : "Connecting LinkedIn…"}</h1>
        <p className="text-sm text-grey-300">
          {error ?? "This only takes a moment. You'll be back to your result straight after."}
        </p>
        {error && <Button onClick={() => onNavigate("/")}>Back home</Button>}
      </section>
    </main>
  );
}
