import { useRef } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { COMMAND_LABELS, type LearnableCommand } from "../../lib/learnedCommands";
import { Button } from "../Button/Button";
import { Dialog, StatRow } from "../Puzzle/Dialog";
import { CommandBadge } from "./CommandBadge";

/** How each command is typed in the simulator; literal Git, never translated. */
const USAGE: Record<LearnableCommand, string> = {
  log: "git log",
  switch: "git switch <branch>",
  merge: "git merge <branch>",
  "cherry-pick": "git cherry-pick <commit>",
  revert: "git revert <commit>",
  rebase: "git rebase <branch>",
  "interactive-rebase": "git rebase -i <branch>",
};

interface CommandDetailDialogProps {
  /** The learned command to explain; undefined keeps the popup closed. */
  command?: LearnableCommand;
  unlockedAt?: string;
  onClose: () => void;
}

/** A learned command: what it does, how to type it, and when the player first used it. */
export function CommandDetailDialog({ command, unlockedAt, onClose }: CommandDetailDialogProps) {
  const { t, formatDate } = useI18n();
  // Keep the last command on screen while the popup animates out.
  const last = useRef({ command, unlockedAt });
  if (command) last.current = { command, unlockedAt };
  const shown = last.current;

  return (
    <Dialog open={Boolean(command)} title={shown.command ? COMMAND_LABELS[shown.command] : ""} onClose={onClose}>
      {shown.command && (
        <>
          <div className="flex items-center gap-3">
            <CommandBadge unlocked size={48} />
            <code className="min-w-0 break-words rounded bg-green-900 px-2 py-1 font-secondary text-xs text-lime-400">
              {USAGE[shown.command]}
            </code>
          </div>
          <p className="text-sm text-grey-50">{t(`commandLearned.${shown.command}.explanation`)}</p>
          {shown.unlockedAt && (
            <StatRow label={t("account.unlocked")} value={formatDate(shown.unlockedAt, { dateStyle: "medium" })} />
          )}
          <Button onClick={onClose}>{t("common.gotIt")}</Button>
        </>
      )}
    </Dialog>
  );
}
