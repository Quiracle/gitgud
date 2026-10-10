import { motion } from "motion/react";
import type { MouseEvent } from "react";
import { spring } from "../../lib/motion";
import { Icon, type IconName } from "../Icon/Icon";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  /** Extra path prefixes that keep this tab highlighted. */
  matches?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Learn", href: "/course", icon: "import_contacts" },
  { label: "Solve", href: "/play", icon: "extension", matches: ["/archive"] },
  { label: "Leaderboard", href: "/leaderboard", icon: "crown" },
  { label: "You", href: "/account", icon: "account_circle" },
];

interface BottomNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

/** Floating tab bar from the Figma home frame (node 24:44222). */
export function BottomNav({ path, onNavigate }: BottomNavProps) {
  const activeHref = NAV_ITEMS.find((item) =>
    [item.href, ...(item.matches ?? [])].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  )?.href;

  return (
    <motion.nav
      aria-label="Main"
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring.soft, delay: 0.25 }}
      className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px]"
    >
      <ul className="flex items-center justify-between rounded border border-lime-400 bg-green-950 p-3 shadow-[0_12px_32px_-12px_rgb(var(--colors-green-950)/0.6)]">
        {NAV_ITEMS.map((item) => {
          const active = item.href === activeHref;
          const follow = (event: MouseEvent<HTMLAnchorElement>) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            onNavigate(item.href);
          };
          return (
            <li key={item.href} className="relative">
              <motion.a
                href={item.href}
                onClick={follow}
                aria-current={active ? "page" : undefined}
                whileTap={{ scale: 0.88 }}
                transition={spring.snappy}
                className="group relative flex min-h-11 w-[59px] flex-col items-center justify-center gap-0.5 text-lime-400"
              >
                {/* Hover previews the active highlight at half strength. */}
                {!active && (
                  <span className="absolute -inset-x-1 -inset-y-1.5 rounded transition-colors duration-200 group-hover:bg-lime-400/[0.07]" />
                )}
                {active && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    transition={spring.layout}
                    className="absolute -inset-x-1 -inset-y-1.5 rounded bg-lime-400/15"
                  />
                )}
                <motion.span
                  className="relative"
                  animate={active ? { y: [0, -4, 0], rotate: [0, -8, 0] } : { y: 0, rotate: 0 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                >
                  <Icon name={item.icon} />
                </motion.span>
                <span className="relative whitespace-nowrap text-2xs leading-none">{item.label}</span>
              </motion.a>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
