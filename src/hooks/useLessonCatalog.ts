import { useMemo } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { learnBasicsCatalog } from "../puzzles";
import { localizeLesson } from "../puzzles/learnBasics/translations";

/** The Learn Basics catalog in the player's language. */
export function useLessonCatalog() {
  const { locale } = useI18n();
  return useMemo(() => learnBasicsCatalog.map((lesson) => localizeLesson(lesson, locale)), [locale]);
}
