import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Button } from "../components/Button/Button";
import { DifficultyBadge } from "../components/Difficulty/DifficultyBadge";
import { CommitTree } from "../components/GitGraph/CommitTree";
import { Icon, type IconName } from "../components/Icon/Icon";
import { CARD_SURFACE, SiteFooter } from "../components/Layout/SiteFooter";
import { chickenLookFromState, PixelChicken } from "../components/Illustration/PixelChicken";
import { WelcomeTutorial } from "../components/Onboarding/WelcomeTutorial";
import { ShareButton, useResultShare } from "../components/Share/ResultShare";
import { HowToPlayLink } from "../components/Puzzle/HowToPlay";
import { PuzzlePreview, useCanvasHandOff } from "../components/Puzzle/PuzzlePreview";
import { StreakTrail } from "../components/Streak/StreakTrail";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { useDragScroll } from "../hooks/useDragScroll";
import { useProgressInsights } from "../hooks/useProgressInsights";
import { openProgressStore } from "../storage/browserProgress";
import { hasSeenWelcome, markWelcomeSeen } from "../storage/onboarding";
import { rise, spring, stagger } from "../lib/motion";
import { learnBasicsCatalog, type PublicPuzzleDefinition } from "../puzzles";
import type { LearnBasicsLesson } from "../puzzles/learnBasics/types";

interface HomeScreenProps {
  onNavigate: (path: string) => void;
}

/** Lessons that introduce the headline concepts, shown under "Recommended for you". */
const RECOMMENDED_LESSONS = ["basics-05-three-way-merge", "basics-06-cherry-pick", "basics-08-rebase"];


/** Figma home frame (node 24:33046). */
export function HomeScreen({ onNavigate }: HomeScreenProps) {
  const daily = useDailyPuzzle();
  const handOff = useCanvasHandOff(onNavigate);
  const { streak, recent } = useProgressInsights();
  const todaysResult = useMemo(
    () => (daily.status === "ready" ? openProgressStore().latestCompletion(daily.puzzle.id, daily.puzzle.version) : undefined),
    [daily],
  );
  const solvedToday = Boolean(todaysResult);
  const sharing = useResultShare(
    daily.status === "ready" ? daily.puzzle : undefined,
    todaysResult
      ? { elapsedMs: todaysResult.elapsedMs, restartCount: todaysResult.restartCount, assisted: Boolean(todaysResult.assisted) }
      : null,
  );
  const courses = useDragScroll<HTMLUListElement>();
  const [tutorial, setTutorial] = useState(false);
  const closeTutorial = useCallback(() => {
    markWelcomeSeen();
    setTutorial(false);
  }, []);

  // First visit: let Home settle in, then walk through how the game works.
  useEffect(() => {
    if (hasSeenWelcome()) return;
    const timer = window.setTimeout(() => setTutorial(true), 700);
    return () => window.clearTimeout(timer);
  }, []);


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
                  days={recent}
                  label={streak > 0 ? `${streak}-day${streak === 1 ? "" : "s"} streak!` : "Start your streak!"}
                />
              </div>
              <PuzzlePreview
                canvasRef={handOff.canvasRef}
                puzzle={daily.status === "ready" ? daily.puzzle : undefined}
                onScale={handOff.onScale}
                onOpen={() => handOff.open("/play")}
                openLabel="Open today's puzzle"
                showDifficulty
                fallback={
                  daily.status === "error" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
                      <p className="text-sm text-grey-200">{daily.message}</p>
                      <Button variant="outline" fullWidth={false} onClick={() => void daily.reload()}>
                        Try again
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            </div>
            <HowToPlayLink learnHref="/course" onNavigate={onNavigate} onTutorial={() => setTutorial(true)} />
          </div>
          <div className="flex gap-2">
            <Button href="/play" onNavigate={handOff.open}>
              <Shimmer />
              <span className="relative">{solvedToday ? "See your result" : "Solve the puzzle!"}</span>
            </Button>
            {sharing.available && <ShareButton onClick={sharing.share} />}
          </div>
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
              ref={courses}
              className="no-scrollbar -mx-6 -my-2 flex cursor-grab select-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-6 px-6 py-2"
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

      <SiteFooter />
      <WelcomeTutorial open={tutorial} onClose={closeTutorial} onNavigate={onNavigate} />
      {sharing.dialog}
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
