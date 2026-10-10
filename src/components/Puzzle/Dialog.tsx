import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { spring } from "../../lib/motion";
import { Icon } from "../Icon/Icon";

interface DialogProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  /** "wide" gives long, text-heavy dialogs room on tablets and desktops; phones keep the Figma width. */
  size?: "default" | "wide";
  children: ReactNode;
}

/** Figma "pop up" (node 28:113442): lime-outlined panel over a dark scrim. */
export function Dialog({ open, title, onClose, size = "default", children }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Move focus into the dialog itself (not a button) so no focus ring flashes on open.
    const timer = window.setTimeout(() => panel.current?.focus({ preventScroll: true }), 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      // Hand focus back without scrolling the page to the trigger.
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
        >
          <div className="absolute inset-0 bg-[#101411]/80" onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`relative flex max-h-[calc(100dvh-48px)] w-full max-w-[327px] ${size === "wide" ? "sm:max-w-[560px]" : ""} flex-col gap-6 overflow-y-auto overscroll-contain rounded border border-lime-400 bg-green-950 p-6 outline-none`}
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12, transition: { duration: 0.16 } }}
            transition={spring.bouncy}
          >
            <h2 id={titleId} className="pr-8 text-xl leading-[25px] text-grey-50">
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center rounded text-lime-400 outline-none transition-colors hover:text-lime-300 focus-visible:bg-lime-400/10 focus-visible:text-lime-300"
              >
                <Icon name="close" size={16} />
              </button>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Label/value row from the result popup. */
export function StatRow({ label, value, large = false }: { label: string; value: ReactNode; large?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 whitespace-nowrap">
      <span className="text-sm text-grey-300">{label}</span>
      <span className={large ? "text-xl leading-[25px] text-grey-50" : "text-sm text-grey-50"}>{value}</span>
    </div>
  );
}
