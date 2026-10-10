import { useMemo } from "react";
import { LessonIntro } from "../components/Puzzle/LessonIntro";
import { useLessonProgress } from "../hooks/useLessonProgress";
import { useI18n } from "../i18n/I18nProvider";
import { localizeLesson } from "../puzzles/learnBasics/translations";
import { learnBasicsCatalog } from "../puzzles";
import type { AvailableLesson } from "../puzzles/learnBasics/types";
import { SolveScreen } from "./SolveScreen";

interface LessonScreenProps {
  lesson: AvailableLesson;
  onNavigate: (path: string) => void;
}

/** A Learn Basics lesson on the shared solve screen; completion unlocks the next one. */
export function LessonScreen({ lesson: source, onNavigate }: LessonScreenProps) {
  const { t, locale } = useI18n();
  const lesson = useMemo(() => localizeLesson(source, locale), [locale, source]);
  const { lessons: completed } = useLessonProgress();
  const next = learnBasicsCatalog.find((candidate) => candidate.order === lesson.order + 1 && candidate.status === "available");

  return (
    <SolveScreen
      puzzle={lesson.puzzle}
      exitHref="/course"
      onNavigate={onNavigate}
      resultAction={
        next
          ? { label: t("lesson.next"), icon: "arrow_forward_ios", href: `/course/${next.id}` }
          : { label: t("lesson.tryDaily"), icon: "extension", href: "/play" }
      }
      intro={{
        title: t("lesson.introTitle", { number: lesson.order, title: lesson.title }),
        body: <LessonIntro commands={lesson.featuredCommands} intro={lesson.intro} />,
        // Replays of finished lessons skip it; the help button still opens it.
        autoOpen: !completed[lesson.id],
      }}
    />
  );
}
