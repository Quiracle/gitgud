import { motion } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { Button } from "../components/Button/Button";
import { DifficultyBadge } from "../components/Difficulty/DifficultyBadge";
import { CommitTree } from "../components/GitGraph/CommitTree";
import { Icon, type IconName } from "../components/Icon/Icon";
import { chickenLookFromState, PixelChicken } from "../components/Illustration/PixelChicken";
import { StreakTrail } from "../components/Streak/StreakTrail";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { rise, spring, stagger } from "../lib/motion";
import { learnBasicsCatalog, type PublicPuzzleDefinition } from "../puzzles";
import type { LearnBasicsLesson } from "../puzzles/learnBasics/types";

interface HomeScreenProps {
  onNavigate: (path: string) => void;
}

/** Grey card from Figma; hover darkens the fill only, so the card never changes size. */
const CARD_SURFACE =
  "rounded border border-grey-300 bg-grey-300 transition-colors duration-200 hover:border-card-hover hover:bg-card-hover";

/** Lessons that introduce the headline concepts, shown under "Recommended for you". */
const RECOMMENDED_LESSONS = ["basics-05-three-way-merge", "basics-06-cherry-pick", "basics-08-rebase"];

/* Streak data arrives with the progress service. Until then guests see an empty trail. */
const STREAK_DAYS = [false, false, false, false, false, false];
const STREAK_COUNT = 0;

/** Figma home frame (node 24:33046). */
export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const daily = useDailyPuzzle();

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <motion.h1
                  className="text-3xl text-grey-50"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring.soft}
                >
                  Today’s challenge:
                </motion.h1>
                <StreakTrail
                  days={STREAK_DAYS}
                  label={STREAK_COUNT > 0 ? `${STREAK_COUNT}-days streak!` : "Start your streak!"}
                />
              </div>
              <DailyPreview state={daily} onRetry={() => void daily.reload()} />
            </div>
            <a
              href="/course"
              onClick={(event) => follow(event, "/course", onNavigate)}
              className="group flex min-h-11 items-center gap-2 self-end text-sm text-grey-50"
            >
              <span className="underline decoration-from-font underline-offset-2">How to play</span>
              <motion.span whileHover={{ rotate: 20 }} transition={spring.snappy} className="flex">
                <Icon name="help" size={16} />
              </motion.span>
            </a>
          </div>
          <Button href="/play" onNavigate={onNavigate}>
            <Shimmer />
            <span className="relative">Solve the puzzle!</span>
          </Button>
        </div>
      </section>

      <section className="px-6 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-4">
            <SectionTitle>Recommended for you</SectionTitle>
            <motion.ul
              className="flex flex-col gap-2"
              variants={stagger(0.08)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
            >
              {learnBasicsCatalog
                .filter((lesson) => RECOMMENDED_LESSONS.includes(lesson.id) && lesson.status === "available")
                .map((lesson) =>
                  lesson.status === "available" ? (
                    <RecommendedCard
                      key={lesson.id}
                      href={`/course/${lesson.id}`}
                      icon="import_contacts"
                      title={lesson.title}
                      description={lesson.summary}
                      puzzle={lesson.puzzle}
                      onNavigate={onNavigate}
                    />
                  ) : null,
                )}
              {daily.status === "ready" && (
                <RecommendedCard
                  href="/play"
                  icon="extension"
                  title={`Daily game · ${formatDay(daily.date)}`}
                  puzzle={daily.puzzle}
                  onNavigate={onNavigate}
                />
              )}
            </motion.ul>
          </div>

          <div className="flex flex-col gap-4">
            <SectionTitle>Start here</SectionTitle>
            <motion.ul
              className="no-scrollbar -mx-6 -my-2 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 py-2"
              variants={stagger(0.07)}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
            >
              {learnBasicsCatalog.map((lesson) => (
                <CourseCard key={lesson.id} lesson={lesson} onNavigate={onNavigate} />
              ))}
            </motion.ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-grey-500 px-6 pb-[var(--nav-clearance)] pt-4">
        <div className="mx-auto flex max-w-md items-start justify-between">
          <p className="text-paragraph text-grey-950">Gitgudgame.lol</p>
          <p className="text-xs text-grey-600">Privacy policy</p>
        </div>
      </footer>
    </div>
  );
}

function DailyPreview({ state, onRetry }: { state: ReturnType<typeof useDailyPuzzle>; onRetry: () => void }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded bg-green-900">
      {state.status === "loading" && <PreviewSkeleton />}
      {state.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="text-sm text-grey-200">{state.message}</p>
          <Button variant="outline" className="w-auto px-5" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
      {state.status === "ready" && (
        <>
          <CommitTree repository={state.puzzle.initialRepository} padding={24} className="absolute inset-0" />
          <motion.div
            className="absolute left-2 top-2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.soft, delay: 0.3 }}
          >
            <DifficultyBadge difficulty={state.puzzle.difficulty} />
          </motion.div>
          <GoalCard puzzle={state.puzzle} />
        </>
      )}
    </div>
  );
}

/** Figma goal card (node 24:33070). */
function GoalCard({ puzzle }: { puzzle: PublicPuzzleDefinition }) {
  return (
    <motion.div
      className="absolute right-2 top-2 flex flex-col rounded border border-grey-300 bg-grey-50 p-2 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)]"
      initial={{ opacity: 0, y: -24, rotate: 8 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...spring.bouncy, delay: 0.45 }}
    >
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      >
        <div className="flex items-center gap-1 text-grey-950">
          <Icon name="flag_2" size={16} />
          <span className="text-paragraph leading-5">Goal</span>
        </div>
        <PixelChicken look={chickenLookFromState(puzzle.target.snapshot)} size={64} />
      </motion.div>
    </motion.div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-10" aria-label="Loading today's puzzle">
      {[1, 2].map((row) => (
        <div key={row} className="flex gap-16">
          {Array.from({ length: row }, (_, index) => (
            <motion.div
              key={index}
              className="h-[85px] w-[66px] rounded border border-grey-700"
              animate={{ opacity: [0.35, 0.8, 0.35] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: (row + index) * 0.15 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A soft highlight that sweeps across the primary call to action. */
function Shimmer() {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent"
      animate={{ x: ["0%", "450%"] }}
      transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2, delay: 1.4 }}
    />
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl leading-[25px] text-green-950">{children}</h2>;
}

interface RecommendedCardProps {
  href: string;
  icon: IconName;
  title: string;
  description?: string;
  puzzle: PublicPuzzleDefinition;
  onNavigate: (path: string) => void;
}

/** Figma recommended card (node 24:35405). */
function RecommendedCard({ href, icon, title, description, puzzle, onNavigate }: RecommendedCardProps) {
  return (
    <motion.li variants={rise}>
      <motion.a
        href={href}
        onClick={(event) => follow(event, href, onNavigate)}
        className={`flex gap-4 p-2 ${CARD_SURFACE}`}
        whileHover={{ y: -2 }}
        whileTap={{ y: 0 }}
        transition={spring.snappy}
      >
        <CommitTree
          repository={puzzle.initialRepository}
          padding={6}
          showRefs={false}
          animateIn={false}
          className="size-16 shrink-0 rounded bg-green-900"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-px">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-grey-950">
              <Icon name={icon} size={16} />
              <span className="truncate text-paragraph leading-5">{title}</span>
            </div>
            {description && <p className="text-xs leading-[15px] text-grey-700">{description}</p>}
          </div>
          <DifficultyBadge difficulty={puzzle.difficulty} className="self-start" />
        </div>
      </motion.a>
    </motion.li>
  );
}

/** Figma "Start here" course card (node 24:42427). */
function CourseCard({ lesson, onNavigate }: { lesson: LearnBasicsLesson; onNavigate: (path: string) => void }) {
  const available = lesson.status === "available";
  const look = chickenLookFromState(available ? lesson.puzzle.target.snapshot : {});
  const content = (
    <>
      <PixelChicken look={look} size={106} className="rounded" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-grey-700">
          <span className="flex-1 text-xs leading-[15px]">Course {lesson.order}</span>
          {available ? <Icon name="arrow_forward_ios" size={16} className="text-grey-950" /> : <span className="text-2xs">Soon</span>}
        </div>
        <p className="line-clamp-2 text-xs leading-[15px] text-grey-950">{lesson.title}</p>
      </div>
    </>
  );

  return (
    <motion.li variants={rise} className="flex snap-start">
      {available ? (
        <motion.a
          href={`/course/${lesson.id}`}
          onClick={(event) => follow(event, `/course/${lesson.id}`, onNavigate)}
          className={`flex w-[124px] flex-col gap-2 p-2 ${CARD_SURFACE}`}
          whileHover={{ y: -3 }}
          whileTap={{ y: 0 }}
          transition={spring.snappy}
        >
          {content}
        </motion.a>
      ) : (
        <div className="flex w-[124px] flex-col gap-2 rounded border border-grey-300 bg-grey-300 p-2 opacity-60">{content}</div>
      )}
    </motion.li>
  );
}

function follow(event: MouseEvent<HTMLAnchorElement>, href: string, onNavigate: (path: string) => void) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate(href);
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
