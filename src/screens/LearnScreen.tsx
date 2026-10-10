import { motion, type Variants } from "motion/react";
import type { MouseEvent } from "react";
import { Button } from "../components/Button/Button";
import { Icon } from "../components/Icon/Icon";
import { chickenLookFromState, PixelChicken } from "../components/Illustration/PixelChicken";
import { CARD_SURFACE, SiteFooter } from "../components/Layout/SiteFooter";
import { HowToPlayLink } from "../components/Puzzle/HowToPlay";
import { PuzzlePreview, useCanvasHandOff } from "../components/Puzzle/PuzzlePreview";
import { useLessonProgress } from "../hooks/useLessonProgress";
import { spring } from "../lib/motion";
import { learnBasicsCatalog } from "../puzzles";
import { isAvailableLesson, type LearnBasicsLesson } from "../puzzles/learnBasics/types";

interface LearnScreenProps {
  onNavigate: (path: string) => void;
}

type Step = "done" | "next" | "todo";

/** Figma "learning" frame (node 39:120578). */
export function LearnScreen({ onNavigate }: LearnScreenProps) {
  const { lessons: completed } = useLessonProgress();
  const handOff = useCanvasHandOff(onNavigate);
  const available = learnBasicsCatalog.filter(isAvailableLesson);
  const next = available.find((lesson) => !completed[lesson.id]);
  const featured = next ?? available.at(-1);
  const started = available.some((lesson) => completed[lesson.id]);
  const stepOf = (lesson: LearnBasicsLesson): Step =>
    completed[lesson.id] ? "done" : lesson.id === next?.id ? "next" : "todo";

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-4">
              <motion.h1
                className="text-3xl text-grey-50"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring.soft}
              >
                {!next ? "You learned the basics!" : started ? "Continue learning!" : "Learn the basics!"}
              </motion.h1>
              <motion.div
                className="flex flex-col gap-0.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.soft, delay: 0.08 }}
              >
                <p className="text-xs leading-[15px] text-grey-300">{next ? "Next lesson:" : "Replay any lesson, or:"}</p>
                <p className="flex items-center gap-1 text-paragraph leading-5 text-grey-50">
                  <Icon name={next ? "import_contacts" : "extension"} size={16} />
                  {next ? next.title : "Try today's daily game"}
                </p>
              </motion.div>
              <PuzzlePreview
                canvasRef={handOff.canvasRef}
                puzzle={featured?.puzzle}
                onScale={handOff.onScale}
                onOpen={() => handOff.open(featured ? `/course/${featured.id}` : "/play")}
                openLabel={featured ? `Open lesson: ${featured.title}` : "Open today's puzzle"}
              />
            </div>
            <HowToPlayLink onNavigate={onNavigate} />
          </div>
          {next ? (
            <Button href={`/course/${next.id}`} onNavigate={handOff.open}>
              Start learning!
            </Button>
          ) : (
            <Button href="/play" onNavigate={onNavigate}>
              Play the daily game
            </Button>
          )}
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-4">
          <h2 className="text-xl leading-[25px] text-green-950">All the courses</h2>
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

const STEP_LABELS: Record<Step, string> = { done: "Completed", next: "Up next", todo: "Not started" };

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
  const available = isAvailableLesson(lesson);
  const href = `/course/${lesson.id}`;
  const card = (
    <>
      <PixelChicken
        look={chickenLookFromState(available ? lesson.puzzle.target.snapshot : {})}
        size={64}
        className="rounded"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-grey-700">
          <span className="flex-1 text-xs leading-[15px]">Course {lesson.order}</span>
          {available ? (
            <Icon name="arrow_forward_ios" size={16} className="text-grey-950" />
          ) : (
            <span className="text-2xs">Soon</span>
          )}
        </div>
        <p className="text-paragraph leading-5 text-grey-950">{lesson.title}</p>
      </div>
    </>
  );

  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(href);
  };

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
        <span className="sr-only">{STEP_LABELS[step]}: </span>
        {available ? (
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
        ) : (
          <div className="flex items-center gap-4 rounded border border-grey-300 bg-grey-300 p-2 opacity-60">{card}</div>
        )}
      </div>
    </motion.li>
  );
}
