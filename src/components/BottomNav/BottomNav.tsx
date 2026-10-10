import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translate";
import { spring } from "../../lib/motion";
import { LoginDialog } from "../Auth/LoginDialog";
import { Icon, type IconName } from "../Icon/Icon";

export interface NavItem {
  label: TranslationKey;
  href: string;
  icon: IconName;
  /** Extra path prefixes that keep this tab highlighted. */
  matches?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "nav.home", href: "/", icon: "home" },
  { label: "nav.learn", href: "/course", icon: "import_contacts" },
  { label: "nav.solve", href: "/play", icon: "extension", matches: ["/archive"] },
  { label: "nav.leaderboard", href: "/leaderboard", icon: "crown" },
  { label: "nav.you", href: "/account", icon: "account_circle" },
];

interface BottomNavProps {
  path: string;
  onNavigate: (path: string) => void;
}

/** Floating tab bar from the Figma home frame (node 24:44222). */
export function BottomNav({ path, onNavigate }: BottomNavProps) {
  // Figma: guests see an outlined "Log in" tab, signed-in players a filled "You" tab.
  const signedIn = useAuth().status === "authenticated";
  const { t } = useI18n();
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (signedIn) setLoginOpen(false);
  }, [signedIn]);
  const items = NAV_ITEMS.map((item): NavItem => {
    if (item.href !== "/account") return item;
    return signedIn ? { ...item, icon: "account_circle_fill" } : { ...item, label: "nav.logIn" };
  });
  const activeHref = items.find((item) =>
    [item.href, ...(item.matches ?? [])].some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
  )?.href;

  return (
    <>
      <motion.nav
        aria-label={t("nav.main")}
        initial={{ y: 120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring.soft, delay: 0.25 }}
        className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[480px]"
      >
        <ul className="flex items-center justify-between rounded border border-lime-400 bg-green-950 p-3 shadow-[0_12px_32px_-12px_rgb(var(--colors-green-950)/0.6)]">
          {items.map((item) => {
            const active = item.href === activeHref;
            const follow = (event: MouseEvent<HTMLAnchorElement>) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              // Guests get the login popup instead of an account page.
              if (item.href === "/account" && !signedIn) setLoginOpen(true);
              else onNavigate(item.href);
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
                    {/* Keyed so signing in swaps the icon with a little pop. */}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={item.icon}
                        className="flex"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={spring.bouncy}
                      >
                        <Icon name={item.icon} />
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                  <span className="relative whitespace-nowrap text-2xs leading-none">{t(item.label)}</span>
                </motion.a>
              </li>
            );
          })}
        </ul>
      </motion.nav>
      {/* Outside the nav: its transform would otherwise trap the fixed dialog. */}
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath={path} />
    </>
  );
}
