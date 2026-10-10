import { useState } from "react";
import { Button } from "../components/Button/Button";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translate";
import { loadGuidedLesson, type GuidedLesson } from "../services/guidedLessons";
import { SolveScreen } from "./SolveScreen";

interface GuidedLessonScreenProps {
  lessonId: string;
  onNavigate: (path: string) => void;
}

/** A personal AI practice puzzle on the shared solve screen. Never ranked, never a streak day. */
export function GuidedLessonScreen({ lessonId, onNavigate }: GuidedLessonScreenProps) {
  const { t } = useI18n();
  const [lesson] = useState(() => loadGuidedLesson(lessonId));

  if (!lesson) {
    return (
      <div className="grid min-h-dvh place-items-center bg-green-950 px-6">
        <div className="flex max-w-sm flex-col gap-4 text-center">
          <h1 className="text-xl text-grey-50">{t("guided.missingTitle")}</h1>
          <p className="text-sm text-grey-300">{t("guided.missingBody")}</p>
          <Button onClick={() => onNavigate("/course")}>{t("guided.backToLearn")}</Button>
        </div>
      </div>
    );
  }

  return (
    <SolveScreen
      puzzle={lesson.puzzle}
      exitHref="/course"
      onNavigate={onNavigate}
      resultAction={{ label: t("guided.backToLearn"), icon: "arrow_forward_ios", href: "/course" }}
      intro={{ title: lesson.puzzle.title, body: <GuidedIntro lesson={lesson} />, autoOpen: true }}
    />
  );
}

/** The server names the practice topic in English; these are its translations. */
const TOPIC_KEYS: Record<string, TranslationKey> = {
  "combining several branches": "guided.topic.severalBranches",
  "undoing a commit with git revert": "guided.topic.revert",
  "copying one commit with git cherry-pick": "guided.topic.cherryPick",
  "fast-forward merges": "guided.topic.fastForward",
  "merging diverged branches": "guided.topic.divergedMerge",
  "moving between branches": "guided.topic.switching",
  "branches and merging": "guided.topic.default",
};

function GuidedIntro({ lesson }: { lesson: GuidedLesson }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1 rounded border border-lime-400/40 bg-lime-400/5 p-3">
        <span className="text-xs leading-[15px] text-grey-400">{t("guided.youAsked")}</span>
        <p className="text-grey-50">{t("guided.quote", { text: lesson.goal })}</p>
        {lesson.topic && <span className="text-xs text-lime-400">{t("guided.practice", { topic: TOPIC_KEYS[lesson.topic] ? t(TOPIC_KEYS[lesson.topic]) : lesson.topic })}</span>}
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
          {t("guided.fallbackNote")}
        </p>
      )}
      <p className="text-xs text-grey-400">{t("guided.hintNote")}</p>
    </div>
  );
}
