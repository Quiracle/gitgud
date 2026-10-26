import { useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { joinDailyAsGuest } from "../../services/leaderboard";
import { readGuestPlayer } from "../../storage/guestPlayer";
import type { CompletionRecord } from "../../storage/progress";
import { Dialog } from "../Puzzle/Dialog";
import { GuestJoinForm } from "./GuestJoinForm";

interface GuestJoinDialogProps {
  open: boolean;
  /** The finished daily to rank under the guest name. */
  completion: CompletionRecord;
  onClose: () => void;
  onJoined: () => void;
  onLogIn: () => void;
}

/** Leaderboard, guests only: put an already-finished daily on the board under a name. */
export function GuestJoinDialog({ open, completion, onClose, onJoined, onLogIn }: GuestJoinDialogProps) {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  async function join(name: string) {
    setSubmitting(true);
    setError(undefined);
    try {
      await joinDailyAsGuest(name, completion);
      onJoined();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Leaderboard submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} title={t("guestJoin.title")} onClose={onClose}>
      <GuestJoinForm
        initialName={readGuestPlayer()?.displayName}
        submitting={submitting}
        error={error}
        onJoin={(name) => void join(name)}
        onLogIn={onLogIn}
      />
    </Dialog>
  );
}
