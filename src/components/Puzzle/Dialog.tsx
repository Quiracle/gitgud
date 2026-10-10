import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { spring } from "../../lib/motion";
import { Icon } from "../Icon/Icon";

interface DialogProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
}

/** Figma "pop up" (node 28:113442): lime-outlined panel over a dark scrim. */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    // Focus the first action so keyboard users land inside the dialog.
    const timer = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("button, a")?.focus(), 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
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
            className="relative flex w-full max-w-[327px] flex-col gap-6 rounded border border-lime-400 bg-green-950 p-6"
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
                className="absolute right-1.5 top-1.5 flex size-11 items-center justify-center text-lime-400 transition-colors hover:text-lime-300"
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
