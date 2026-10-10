import { useState } from "react";
import { Button } from "../components/Button/Button";
import { loadGuidedLesson, type GuidedLesson } from "../services/guidedLessons";
import { SolveScreen } from "./SolveScreen";

interface GuidedLessonScreenProps {
  lessonId: string;
  onNavigate: (path: string) => void;
}

/** A personal AI practice puzzle on the shared solve screen. Never ranked, never a streak day. */
export function GuidedLessonScreen({ lessonId, onNavigate }: GuidedLessonScreenProps) {
  const [lesson] = useState(() => loadGuidedLesson(lessonId));

  if (!lesson) {
    return (
      <div className="grid min-h-dvh place-items-center bg-green-950 px-6">
        <div className="flex max-w-sm flex-col gap-4 text-center">
          <h1 className="text-xl text-grey-50">This practice puzzle isn't on this device</h1>
          <p className="text-sm text-grey-300">Practice puzzles are saved where you built them. Ask for a new one from Learn.</p>
          <Button onClick={() => onNavigate("/course")}>Back to Learn</Button>
        </div>
      </div>
    );
  }

  return (
    <SolveScreen
      puzzle={lesson.puzzle}
      exitHref="/course"
      onNavigate={onNavigate}
      resultAction={{ label: "Back to Learn", icon: "arrow_forward_ios", href: "/course" }}
      intro={{ title: lesson.puzzle.title, body: <GuidedIntro lesson={lesson} />, autoOpen: true }}
    />
  );
}

function GuidedIntro({ lesson }: { lesson: GuidedLesson }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1 rounded border border-lime-400/40 bg-lime-400/5 p-3">
        <span className="text-xs leading-[15px] text-grey-400">You asked about</span>
        <p className="text-grey-50">“{lesson.goal}”</p>
        {lesson.topic && <span className="text-xs text-lime-400">Practice: {lesson.topic}</span>}
      </div>
      <p className="text-grey-50">{lesson.puzzle.description}</p>
      {lesson.puzzle.objectives && lesson.puzzle.objectives.length > 0 && (
        <ol className="flex flex-col gap-2 text-grey-300">
          {lesson.puzzle.objectives.map((objective, index) => (
            <li key={objective} className="flex gap-2">
              <span className="text-lime-400">{index + 1}.</span>
              <span>{objective}</span>
            </li>
          ))}
        </ol>
      )}
      {lesson.personalized === false && (
        <p className="text-xs text-grey-400">
          The builder was busy, so this is a ready-made puzzle at the same level.
        </p>
      )}
      <p className="text-xs text-grey-400">Stuck? The hint button walks you through it step by step.</p>
    </div>
  );
}
