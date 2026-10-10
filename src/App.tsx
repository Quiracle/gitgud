import { useEffect, useState } from "react";
import { AppLink } from "./components/AppLink";
import { learnBasicsCatalog } from "./puzzles";
import { CourseScreen } from "./screens/CourseScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PuzzleScreen } from "./screens/PuzzleScreen";
import { DailyPuzzleScreen } from "./screens/DailyPuzzleScreen";
import { AuthCallbackScreen } from "./screens/AuthCallbackScreen";

function normalizePath(path: string): string {
  if (path === "/") return path;
  return path.replace(/\/+$/, "") || "/";
}

export default function App() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextPath: string) {
    const normalized = normalizePath(nextPath);
    if (normalized !== path) window.history.pushState({}, "", normalized);
    setPath(normalized);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function replace(nextPath: string) {
    const normalized = normalizePath(nextPath);
    window.history.replaceState({}, "", normalized);
    setPath(normalized);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (path === "/") return <HomeScreen onNavigate={navigate} />;

  if (path === "/play") return <DailyPuzzleScreen onNavigate={navigate} />;

  if (path === "/course") return <CourseScreen onNavigate={navigate} />;

  if (path === "/auth/callback") {
    return <AuthCallbackScreen onNavigate={navigate} onReplace={replace} />;
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
