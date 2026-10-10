import { motion } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { spring, tap } from "../../lib/motion";

type Variant = "primary" | "outline";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  /** Renders an in-app link when provided; otherwise a button. */
  href?: string;
  onNavigate?: (path: string) => void;
  onClick?: () => void;
  disabled?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-lime-400 text-green-950",
  outline: "border border-lime-400 bg-green-950 text-lime-400",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  href,
  onNavigate,
  onClick,
  disabled,
}: ButtonProps) {
  const classes = `relative flex min-h-11 w-full select-none items-center justify-center overflow-hidden rounded p-3 text-paragraph disabled:opacity-50 ${VARIANTS[variant]} ${className}`;
  const motionProps = {
    whileTap: disabled ? undefined : tap,
    whileHover: disabled ? undefined : { y: -1 },
    transition: spring.snappy,
  };

  if (href) {
    const follow = (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !onNavigate) return;
      event.preventDefault();
      onNavigate(href);
    };
    return (
      <motion.a href={href} onClick={follow} className={classes} {...motionProps}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} disabled={disabled} className={classes} {...motionProps}>
      {children}
    </motion.button>
  );
}
