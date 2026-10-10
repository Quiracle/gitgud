import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { Icon, type IconName } from "../Icon/Icon";

interface ActionBarProps {
  onExit: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onHint: () => void;
  onGiveUp: () => void;
  giveUpDisabled?: boolean;
  restartDisabled?: boolean;
  hintDisabled?: boolean;
  className?: string;
}

/**
 * Figma puzzle action bar (node 36:120556). Items share the width evenly; on phones
 * only Exit and Give up keep their labels so everything fits.
 */
export function ActionBar({
  onExit,
  onRestart,
  onHelp,
  onHint,
  onGiveUp,
  giveUpDisabled,
  restartDisabled,
  hintDisabled,
  className = "",
}: ActionBarProps) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("actions.label")} className={`flex items-center justify-between bg-green-950 px-6 py-1 lg:px-4 ${className}`}>
      <Action icon="arrow_back_ios_new" label={t("actions.exit")} onClick={onExit} />
      <Action icon="forward_media" label={t("actions.restart")} compact onClick={onRestart} disabled={restartDisabled} />
      <Action icon="help" label={t("actions.help")} compact onClick={onHelp} />
      <Action icon="lightbulb_2" label={t("actions.hint")} compact onClick={onHint} disabled={hintDisabled} />
      <Action icon="close" label={t("actions.giveUp")} onClick={onGiveUp} disabled={giveUpDisabled} />
    </nav>
  );
}

interface ActionProps {
  icon: IconName;
  label: string;
  /** Icon only on phones, with the label kept for screen readers. */
  compact?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function Action({ icon, label, compact = false, onClick, disabled }: ActionProps) {
  const text: ReactNode = compact ? <span className="sr-only sm:not-sr-only">{label}</span> : label;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`-mx-2 flex min-h-11 items-center gap-1 rounded px-2 text-paragraph leading-5 text-lime-400 transition-colors hover:bg-lime-400/[0.07] hover:text-lime-300 active:bg-lime-400/15 disabled:opacity-40 ${
        compact ? "min-w-11 justify-center sm:min-w-0" : ""
      }`}
    >
      <Icon name={icon} size={compact ? null : 16} className={compact ? "size-5 sm:size-4" : ""} />
      {text}
    </button>
  );
}
