import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { AppLink } from "./components/AppLink";
import { useAuth } from "./context/AuthContext";
import { useI18n } from "./i18n/I18nProvider";
import { claimGuestDailies } from "./services/leaderboard";
import { openProgressStore } from "./storage/browserProgress";
import { BottomNav } from "./components/BottomNav/BottomNav";
import { peekCanvasOrigin } from "./lib/canvasTransition";
import { spring } from "./lib/motion";
import { learnBasicsCatalog } from "./puzzles";
import { LearnScreen } from "./screens/LearnScreen";
import { LessonScreen } from "./screens/LessonScreen";
import { GuidedLessonScreen } from "./screens/GuidedLessonScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { DailyPuzzleScreen } from "./screens/DailyPuzzleScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { LeaderboardScreen } from "./screens/LeaderboardScreen";
import { AccountScreen } from "./screens/AccountScreen";

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
  const { status: authStatus, user } = useAuth();

  // Daily solves finished as a guest join the player's leaderboard once they sign in.
  useEffect(() => {
    if (authStatus !== "authenticated" || !user) return;
    claimGuestDailies(openProgressStore(), user.id).catch(() => {
      // Unsubmitted solves stay unranked and are retried on the next sign-in or visit.
    });
  }, [authStatus, user?.id]);
  // A shared-element hand-off (Home canvas → puzzle) replaces the page fade.
  const [handOff, setHandOff] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setHandOff(false);
      setPath(normalizePath(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextPath: string) {
    const normalized = normalizePath(nextPath);
    if (normalized !== path) window.history.pushState({}, "", normalized);
    setHandOff(peekCanvasOrigin() !== null);
    setPath(normalized);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function replace(nextPath: string) {
    const normalized = normalizePath(nextPath);
    window.history.replaceState({}, "", normalized);
    setHandOff(false);
    setPath(normalized);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false} custom={handOff}>
        <motion.div
          key={path}
          custom={handOff}
          variants={PAGE}
          initial="enter"
          animate="center"
          exit="leave"
          transition={spring.soft}
        >
          {renderScreen(path, navigate, replace)}
        </motion.div>
      </AnimatePresence>
      {showsBottomNav(path) && <BottomNav path={path} onNavigate={navigate} />}
    </MotionConfig>
  );
}

const PAGE = {
  enter: (handOff: boolean) => (handOff ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }),
  center: { opacity: 1, y: 0 },
  leave: (handOff: boolean) =>
    handOff ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

/** The puzzle screens own the full viewport for the board and terminal. */
function showsBottomNav(path: string): boolean {
  return path === "/" || path === "/course" || path === "/leaderboard" || path === "/account";
}

function renderScreen(
  path: string,
  navigate: (path: string) => void,
  replace: (path: string) => void,
): ReactNode {
  if (path === "/") return <HomeScreen onNavigate={navigate} />;

  if (path === "/play") return <DailyPuzzleScreen onNavigate={navigate} />;

  if (path === "/course") return <LearnScreen onNavigate={navigate} />;

  if (path === "/auth/callback") {
    return <AuthCallbackScreen onNavigate={navigate} onReplace={replace} />;
  }

  if (path === "/account") return <AccountScreen onNavigate={navigate} />;

  if (path === "/leaderboard") return <LeaderboardScreen onNavigate={navigate} />;

  if (path.startsWith("/course/practice/")) {
    const lessonId = decodeURIComponent(path.slice("/course/practice/".length));
    return <GuidedLessonScreen key={lessonId} lessonId={lessonId} onNavigate={navigate} />;
  }

  if (path.startsWith("/course/")) {
    const lessonId = decodeURIComponent(path.slice("/course/".length));
    const lesson = learnBasicsCatalog.find((candidate) => candidate.id === lessonId);
    if (lesson?.status === "available") {
      return (
        <LessonScreen key={lesson.id} lesson={lesson} onNavigate={navigate} />
      );
    }
  }

  return <NotFound onNavigate={navigate} />;
}

function NotFound({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-300">404</p>
        <h1 className="mt-3 text-3xl font-black">{t("notFound.title")}</h1>
        <AppLink
          href="/"
          onNavigate={onNavigate}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 font-bold text-slate-950"
        >
          {t("common.returnHome")}
        </AppLink>
      </div>
    </div>
  );
}
