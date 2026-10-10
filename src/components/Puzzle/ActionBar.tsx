import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon/Icon";

interface ActionBarProps {
  onExit: () => void;
  onHelp: () => void;
  onHint: () => void;
  onGiveUp: () => void;
  giveUpDisabled?: boolean;
  className?: string;
}

/** Figma puzzle action bar (node 36:120556). */
export function ActionBar({ onExit, onHelp, onHint, onGiveUp, giveUpDisabled, className = "" }: ActionBarProps) {
  return (
    <nav aria-label="Puzzle actions" className={`flex items-center justify-between bg-green-950 px-6 py-1 sm:justify-start sm:gap-10 lg:justify-between lg:gap-0 ${className}`}>
      <Action icon="arrow_back_ios_new" onClick={onExit}>Exit</Action>
      <Action icon="help" onClick={onHelp}>Help</Action>
      <Action icon="lightbulb_2" onClick={onHint}>Hint</Action>
      <Action icon="close" onClick={onGiveUp} disabled={giveUpDisabled}>Give up</Action>
    </nav>
  );
}

function Action({ icon, onClick, disabled, children }: { icon: IconName; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="-mx-2 flex min-h-11 items-center gap-1 rounded px-2 text-paragraph leading-5 text-lime-400 transition-colors hover:bg-lime-400/[0.07] hover:text-lime-300 active:bg-lime-400/15 disabled:opacity-40"
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}
