import { motion, type Variants } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "../components/Button/Button";
import { CommitTree } from "../components/GitGraph/CommitTree";
import { GuidedLessonPrompt } from "../components/GuidedLesson/GuidedLessonPrompt";
import { Icon } from "../components/Icon/Icon";
import { chickenLookFromState, PixelChicken } from "../components/Illustration/PixelChicken";
import { CARD_SURFACE, SiteFooter } from "../components/Layout/SiteFooter";
import { HowToPlayLink } from "../components/Puzzle/HowToPlay";
import { useLessonCatalog } from "../hooks/useLessonCatalog";
import { useLessonProgress } from "../hooks/useLessonProgress";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/translate";
import { spring } from "../lib/motion";
import { isAvailableLesson, type LearnBasicsLesson } from "../puzzles/learnBasics/types";

interface LearnScreenProps {
  onNavigate: (path: string) => void;
}

type Step = "done" | "next" | "todo";

/** Figma "learning" frame (node 39:120578). */
export function LearnScreen({ onNavigate }: LearnScreenProps) {
  const { t } = useI18n();
  const learnBasicsCatalog = useLessonCatalog();
  const { lessons: completed } = useLessonProgress();
  const available = learnBasicsCatalog.filter(isAvailableLesson);
  const next = available.find((lesson) => !completed[lesson.id]);
  const stepOf = (lesson: LearnBasicsLesson): Step =>
    completed[lesson.id] ? "done" : lesson.id === next?.id ? "next" : "todo";

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-4">
            <motion.h1
              className="text-3xl text-grey-50"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.soft}
            >
              {t("learn.title")}
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.soft, delay: 0.06 }}
            >
              <GuidedLessonPrompt
                returnPath="/course"
                onGenerated={(lesson) => onNavigate(`/course/practice/${encodeURIComponent(lesson.id)}`)}
              />
            </motion.div>
          </div>

          <motion.div
            className="flex flex-col gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.soft, delay: 0.12 }}
          >
            {next ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <p className="text-paragraph text-grey-50">{t("learn.continue")}</p>
                  <p className="text-xs leading-[15px] text-grey-300">{t("learn.nextLesson")}</p>
                </div>
                <LessonCard lesson={next} thumbnail="graph" onNavigate={onNavigate} />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-paragraph text-grey-50">{t("learn.orDaily")}</p>
                <Button variant="outline" href="/play" onNavigate={onNavigate}>
                  {t("learn.playDaily")}
                </Button>
              </div>
            )}
            <HowToPlayLink onNavigate={onNavigate} />
          </motion.div>
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <h2 className="text-xl leading-[25px] text-green-950">{t("learn.allCourses")}</h2>
          <motion.ol
            variants={{ show: { transition: { staggerChildren: 0.07 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-40px" }}
          >
            {learnBasicsCatalog.map((lesson, index) => (
              <CourseRow
                key={lesson.id}
                lesson={lesson}
                step={stepOf(lesson)}
                first={index === 0}
                last={index === learnBasicsCatalog.length - 1}
                onNavigate={onNavigate}
              />
            ))}
          </motion.ol>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

const rowVariants: Variants = {
  hidden: { opacity: 0, x: 16 },
  show: { opacity: 1, x: 0, transition: spring.soft },
};

const railVariants: Variants = {
  hidden: { scaleY: 0 },
  show: { scaleY: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

const stepVariants: Variants = {
  hidden: { scale: 0, rotate: -45 },
  show: { scale: 1, rotate: 0, transition: spring.bouncy },
};

const STEP_STYLES: Record<Step, string> = {
  done: "border border-green-800 bg-lime-400",
  next: "border-2 border-green-800 bg-lime-400/50",
  todo: "border border-green-800",
};

const STEP_LABELS: Record<Step, TranslationKey> = { done: "learn.step.done", next: "learn.step.next", todo: "learn.step.todo" };

interface CourseRowProps {
  lesson: LearnBasicsLesson;
  step: Step;
  first: boolean;
  last: boolean;
  onNavigate: (path: string) => void;
}

/**
 * A course card with its progress marker. The rail lives in the same row as the card,
 * so each marker sits exactly at the card's vertical centre whatever the card height.
 */
function CourseRow({ lesson, step, first, last, onNavigate }: CourseRowProps) {
  const { t } = useI18n();
  return (
    <motion.li className="flex gap-4" variants={rowVariants}>
      <div className="flex w-3 shrink-0 flex-col items-center" aria-hidden>
        <motion.span
          className={`w-px flex-1 origin-top ${first ? "" : "bg-green-800"}`}
          variants={railVariants}
        />
        <motion.span className={`block size-3 shrink-0 rounded ${STEP_STYLES[step]}`} variants={stepVariants} />
        <motion.span
          className={`w-px flex-1 origin-top ${last ? "" : "bg-green-800"}`}
          variants={railVariants}
        />
        {/* Bridges the gap to the next card so the rail stays continuous. */}
        {!last && <motion.span className="h-2 w-px origin-top bg-green-800" variants={railVariants} />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? "" : "pb-2"}`}>
        <span className="sr-only">{t(STEP_LABELS[step])}: </span>
        <LessonCard lesson={lesson} thumbnail="chicken" onNavigate={onNavigate} />
      </div>
    </motion.li>
  );
}

interface LessonCardProps {
  lesson: LearnBasicsLesson;
  /** "graph" is the lesson's starting history (Figma node 45:158202); "chicken" its goal. */
  thumbnail: "graph" | "chicken";
  onNavigate: (path: string) => void;
}

/** Grey course card (Figma node 45:158201). Lessons that aren't ready render dimmed. */
function LessonCard({ lesson, thumbnail, onNavigate }: LessonCardProps) {
  const { t } = useI18n();
  const available = isAvailableLesson(lesson);
  const href = `/course/${lesson.id}`;
  let picture: ReactNode;
  if (thumbnail === "graph" && available) {
    picture = (
      <div className="pointer-events-none size-16 shrink-0 overflow-hidden rounded bg-green-900">
        <CommitTree repository={lesson.puzzle.initialRepository} padding={9} showRefs={false} className="size-full" />
      </div>
    );
  } else {
    picture = (
      <PixelChicken
        look={chickenLookFromState(available ? lesson.puzzle.target.snapshot : {})}
        size={64}
        className="rounded"
      />
    );
  }

  const card = (
    <>
      {picture}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-grey-700">
          <span className="flex-1 text-xs leading-[15px]">{t("common.course", { number: lesson.order })}</span>
          {available ? (
            <Icon name="arrow_forward_ios" size={16} className="text-grey-950" />
          ) : (
            <span className="text-2xs">{t("common.soon")}</span>
          )}
        </div>
        <p className="text-paragraph leading-5 text-grey-950">{lesson.title}</p>
      </div>
    </>
  );

  if (!available) {
    return <div className="flex items-center gap-4 rounded border border-grey-300 bg-grey-300 p-2 opacity-60">{card}</div>;
  }

  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };

  return (
    <motion.a
      href={href}
      onClick={follow}
      className={`flex items-center gap-4 p-2 ${CARD_SURFACE}`}
      whileHover={{ y: -2 }}
      whileTap={{ y: 0 }}
      transition={spring.snappy}
    >
      {card}
    </motion.a>
  );
}
