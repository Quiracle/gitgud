import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { AppLink } from "./components/AppLink";
import { BottomNav } from "./components/BottomNav/BottomNav";
import { peekCanvasOrigin } from "./lib/canvasTransition";
import { spring } from "./lib/motion";
import { learnBasicsCatalog } from "./puzzles";
import { CourseScreen } from "./screens/CourseScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PuzzleScreen } from "./screens/PuzzleScreen";
import { DailyPuzzleScreen } from "./screens/DailyPuzzleScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";
import { AuthPanel } from "./components/AuthPanel";

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));
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

  if (path === "/course") return <CourseScreen onNavigate={navigate} />;

  if (path === "/auth/callback") {
    return <AuthCallbackScreen onNavigate={navigate} onReplace={replace} />;
  }

  // Sign-in lives under "You" until the account screen is designed.
  if (path === "/account") {
    return (
      <main className="min-h-dvh bg-green-50 px-6 pb-[var(--nav-clearance)] pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto max-w-md">
          <AuthPanel />
        </div>
      </main>
    );
  }

  if (path === "/leaderboard") {
    return <ComingSoon title="Leaderboard" onNavigate={navigate} />;
  }

  if (path.startsWith("/course/")) {
    const lessonId = decodeURIComponent(path.slice("/course/".length));
    const lesson = learnBasicsCatalog.find((candidate) => candidate.id === lessonId);
    if (lesson?.status === "available") {
      return (
        <PuzzleScreen
          key={lesson.id}
          puzzle={lesson.puzzle}
          eyebrow={`Learn Basics · Lesson ${lesson.order}`}
          backHref="/course"
          backLabel="Course"
          accent="violet"
          onNavigate={navigate}
        />
      );
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-rose-300">404</p>
        <h1 className="mt-3 text-3xl font-black">That screen does not exist</h1>
        <AppLink
          href="/"
          onNavigate={navigate}
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 font-bold text-slate-950"
        >
          Return home
        </AppLink>
      </div>
    </div>
  );
}

function ComingSoon({ title, onNavigate }: { title: string; onNavigate: (path: string) => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-green-50 px-6 pb-[var(--nav-clearance)] text-grey-950">
      <div className="max-w-sm text-center">
        <p className="font-secondary text-xs uppercase tracking-[0.2em] text-grey-600">Coming soon</p>
        <h1 className="mt-2 text-3xl">{title}</h1>
        <AppLink href="/" onNavigate={onNavigate} className="mt-6 inline-flex min-h-11 items-center underline">
          Back home
        </AppLink>
      </div>
    </main>
  );
}
