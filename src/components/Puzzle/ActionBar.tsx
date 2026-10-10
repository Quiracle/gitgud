import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";

interface ActionBarProps {
  onExit: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onHint: () => void;
  onGiveUp: () => void;
  giveUpDisabled?: boolean;
  className?: string;
}

/**
 * Figma puzzle action bar (node 36:120556). Items share the width evenly; on phones
 * only Exit and Give up keep their labels so everything fits.
 */
export function ActionBar({ onExit, onRestart, onHelp, onHint, onGiveUp, giveUpDisabled, className = "" }: ActionBarProps) {
  return (
    <nav aria-label="Puzzle actions" className={`flex items-center justify-between bg-green-950 px-6 py-1 ${className}`}>
      <Action icon="arrow_back_ios_new" label="Exit" onClick={onExit} />
      <Action icon="restart_alt" label="Restart" compact onClick={onRestart} />
      <Action icon="help" label="Help" compact onClick={onHelp} />
      <Action icon="lightbulb_2" label="Hint" compact onClick={onHint} />
      <Action icon="close" label="Give up" onClick={onGiveUp} disabled={giveUpDisabled} />
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
