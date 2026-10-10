import { learnBasicsCatalog } from "../puzzles";
import type { AvailableLesson } from "../puzzles/learnBasics/types";
import { SolveScreen } from "./SolveScreen";

interface LessonScreenProps {
  lesson: AvailableLesson;
  onNavigate: (path: string) => void;
}

/** A Learn Basics lesson on the shared solve screen; completion unlocks the next one. */
export function LessonScreen({ lesson, onNavigate }: LessonScreenProps) {
  const next = learnBasicsCatalog.find((candidate) => candidate.order === lesson.order + 1 && candidate.status === "available");

  return (
    <SolveScreen
      puzzle={lesson.puzzle}
      exitHref="/course"
      onNavigate={onNavigate}
      resultAction={
        next
          ? { label: "Next lesson", icon: "arrow_forward_ios", href: `/course/${next.id}` }
          : { label: "Try the daily game", icon: "extension", href: "/play" }
      }
    />
  );
}
