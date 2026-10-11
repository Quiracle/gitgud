import type { MouseEvent, ReactNode } from "react";

type Variant = "primary" | "outline" | "outlineLight" | "tertiary";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  /** Renders an in-app link when provided; otherwise a button. */
  href?: string;
  onNavigate?: (path: string) => void;
  onClick?: () => void;
  disabled?: boolean;
  /** "submit" lets a button submit its form. */
  type?: "button" | "submit";
  /** Stretch to the container width (default). Compact buttons size to their label. */
  fullWidth?: boolean;
}

/* Buttons never move: hover lightens, press deepens, both as colour only. */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-lime-400 text-green-950 hover:bg-lime-300 active:bg-lime-500",
  outline: "border border-lime-400 bg-green-950 text-lime-400 hover:bg-lime-400/10 active:bg-lime-400/20",
  /** Outline on the light page background: dark border and label, page-coloured fill. */
  outlineLight: "border border-green-950 bg-green-50 text-green-950 hover:bg-green-950/10 active:bg-green-950/20",
  tertiary: "text-lime-400 underline decoration-from-font underline-offset-2 hover:bg-lime-400/10 active:bg-lime-400/20",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  href,
  onNavigate,
  onClick,
  disabled,
  type = "button",
  fullWidth = true,
}: ButtonProps) {
  const classes = `relative flex min-h-11 ${fullWidth ? "w-full" : "w-auto px-5"} select-none items-center justify-center overflow-hidden rounded p-3 text-paragraph transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`;

  if (href) {
    const follow = (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onNavigate) return;
      event.preventDefault();
      onNavigate(href);
    };
    return (
      <a href={href} onClick={follow} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
