import { motion, type Variants } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { LoginDialog } from "../components/Auth/LoginDialog";
import { Button } from "../components/Button/Button";
import { DifficultyBadge } from "../components/Difficulty/DifficultyBadge";
import { Icon } from "../components/Icon/Icon";
import { PixelChicken, type ChickenLook } from "../components/Illustration/PixelChicken";
import { SiteFooter } from "../components/Layout/SiteFooter";
import { TimeHistogram } from "../components/Leaderboard/TimeHistogram";
import { useAuth } from "../context/AuthContext";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { formatDuration } from "../lib/format";
import { spring } from "../lib/motion";
import { getDailyLeaderboard, type LeaderboardEntry } from "../services/leaderboard";
import { openProgressStore } from "../storage/browserProgress";

interface LeaderboardScreenProps {
  onNavigate: (path: string) => void;
}

type Board =
  | { status: "loading" }
  | { status: "ready"; entries: LeaderboardEntry[] }
  | { status: "error"; message: string };

/** Dev-only: `/leaderboard?demo` fills the board with sample players for design review. */
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has("demo");

function demoEntries(): Promise<LeaderboardEntry[]> {
  const names = ["pixelhen", "rebase_queen", "maria", "cherrypicker", "octo_chick", "mergeconflict", "HEADless", "ffonly"];
  const entries = names.map((displayName, index) => ({
    rank: index + 1,
    displayName,
    elapsedMs: 41_000 + index * 23_500 + (index % 3) * 7_000,
    restartCount: Math.floor(index / 3),
    commandCount: 3 + (index % 4),
    completedAt: new Date(Date.now() - index * 600_000).toISOString(),
    isCurrentUser: displayName === "maria",
  }));
  return new Promise((resolve) => window.setTimeout(() => resolve(entries), 600));
}

/** Podium chickens: gold hat for the winner, then shades and a scarf. */
const PODIUM_LOOKS: Record<number, ChickenLook> = {
  1: { chicken: true, body: "default", parts: { hat: "gold", crest: "default" } },
  2: { chicken: true, body: "default", parts: { sunglasses: "black", crest: "default" } },
  3: { chicken: true, body: "default", parts: { scarf: "red", crest: "default" } },
};
const PLAIN_CHICKEN: ChickenLook = { chicken: true, body: "default", parts: { crest: "default" } };

/** Daily leaderboard, built in the language of the Home and Learn screens. */
export function LeaderboardScreen({ onNavigate }: LeaderboardScreenProps) {
  const daily = useDailyPuzzle();
  const { status: authStatus } = useAuth();
  const signedIn = authStatus === "authenticated";
  const [loginOpen, setLoginOpen] = useState(false);
  const [board, setBoard] = useState<Board>({ status: "loading" });

  const puzzle = daily.status === "ready" ? daily.puzzle : undefined;
  const dailyError = daily.status === "error" ? daily.message : undefined;
  const solvedToday = useMemo(
    () => Boolean(puzzle && openProgressStore().latestCompletion(puzzle.id, puzzle.version)),
    [puzzle],
  );

  useEffect(() => {
    if (dailyError) setBoard({ status: "error", message: dailyError });
    if (!puzzle) return;
    let cancelled = false;
    setBoard({ status: "loading" });
    const load = DEMO ? demoEntries() : getDailyLeaderboard(puzzle.id, puzzle.version, 100);
    load
      .then((entries) => !cancelled && setBoard({ status: "ready", entries }))
      .catch((reason) => {
        if (cancelled) return;
        const message = reason instanceof Error ? reason.message : "";
        setBoard({
          status: "error",
          message: message.includes("not configured")
            ? "The leaderboard needs a connection. You can keep playing as a guest."
            : "The leaderboard is unavailable right now. Try again in a moment.",
        });
      });
    return () => {
      cancelled = true;
    };
    // Refetch after signing in so your own row is marked.
  }, [puzzle, dailyError, signedIn]);

  const entries = board.status === "ready" ? board.entries : [];
  const podium = entries.filter((entry) => entry.rank <= 3);
  const me = entries.find((entry) => entry.isCurrentUser);

  return (
    <div className="min-h-dvh bg-green-50">
      <section className="bg-green-950 px-6 pb-6 pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col gap-2">
            <motion.h1
              className="text-3xl text-grey-50"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.soft}
            >
              Leaderboard
            </motion.h1>
            <motion.div
              className="flex items-center justify-between gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.soft, delay: 0.08 }}
            >
              <p className="flex items-center gap-1 text-paragraph leading-5 text-grey-50">
                <Icon name="extension" size={16} />
                Daily game · {formatDay(daily.date)}
              </p>
              {puzzle && <DifficultyBadge difficulty={puzzle.difficulty} />}
            </motion.div>
          </div>

          <div>
            {board.status === "loading" && <PodiumSkeleton />}
            {board.status === "ready" && podium.length > 0 && <Podium entries={podium} />}
            {board.status === "ready" && podium.length === 0 && (
              <EmptyState title="No ranked solves yet" body="Be the first chicken on today's podium." />
            )}
            {board.status === "error" && <EmptyState title="Leaderboard offline" body={board.message} />}
          </div>

          {!signedIn ? (
            <Button onClick={() => setLoginOpen(true)}>Log in to get ranked</Button>
          ) : !solvedToday ? (
            <Button href="/play" onNavigate={onNavigate}>
              Solve the puzzle!
            </Button>
          ) : null}
        </div>
      </section>

      {board.status === "ready" && entries.length > 0 && (
        <section className="px-6 py-6">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl leading-[25px] text-green-950">Today's ranking</h2>
              {me && <span className="text-xs text-grey-700">You're #{me.rank}</span>}
            </div>
            <motion.ol
              className="flex flex-col gap-2"
              variants={{ show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {entries.map((entry) => (
                <EntryRow key={`${entry.rank}-${entry.displayName}-${entry.completedAt}`} entry={entry} />
              ))}
            </motion.ol>
            <p className="text-xs text-grey-600">Ranked by time, then retries, then commands.</p>
            <TimeHistogram entries={entries} />
          </div>
        </section>
      )}

      <SiteFooter />
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath="/leaderboard" />
    </div>
  );
}

const PODIUM_ORDER = [2, 1, 3];
const PODIUM_HEIGHT: Record<number, number> = { 1: 96, 2: 72, 3: 56 };

/** Top three on steps, winner in the middle. Steps rise, then the chickens drop on. */
function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  const byRank = new Map(entries.map((entry) => [entry.rank, entry]));
  return (
    <div className="flex items-end justify-center gap-3 pt-2" aria-label="Top three">
      {PODIUM_ORDER.map((rank, index) => {
        const entry = byRank.get(rank);
        const first = rank === 1;
        return (
          <div key={rank} className="flex w-[100px] flex-col items-center gap-2">
            {entry ? (
              <motion.div
                className="flex w-full flex-col items-center gap-1"
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.bouncy, delay: 0.35 + index * 0.12 }}
              >
                {/* Only your own chicken is outlined. */}
                <PixelChicken
                  look={PODIUM_LOOKS[rank]}
                  size={first ? 64 : 48}
                  className={`rounded ${entry.isCurrentUser ? "outline outline-2 outline-lime-400" : ""}`}
                  label={`${entry.displayName}, rank ${rank}`}
                />
                <p className="w-full truncate text-center text-xs text-grey-50">{entry.isCurrentUser ? "You" : entry.displayName}</p>
                <p className="text-xs text-grey-300">{formatDuration(entry.elapsedMs)}</p>
              </motion.div>
            ) : (
              <div className="h-[60px]" />
            )}
            <motion.div
              className={`flex w-full items-start justify-center rounded border pt-2 ${
                first ? "border-lime-400 bg-lime-400/15" : "border-grey-700 bg-green-900"
              }`}
              style={{ height: PODIUM_HEIGHT[rank], originY: 1 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ ...spring.soft, delay: index * 0.1 }}
            >
              <span className={`text-2xl leading-8 ${first ? "text-lime-400" : "text-grey-300"}`}>{rank}</span>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-3 pt-2" aria-label="Loading leaderboard">
      {PODIUM_ORDER.map((rank, index) => (
        <motion.div
          key={rank}
          className="w-[100px] rounded border border-grey-700"
          style={{ height: PODIUM_HEIGHT[rank] + 90 }}
          animate={{ opacity: [0.35, 0.8, 0.35] }}
          transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.15 }}
        />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded border border-grey-700 bg-green-900 px-6 py-8 text-center">
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <PixelChicken look={PLAIN_CHICKEN} size={64} className="rounded" />
      </motion.div>
      <p className="text-xl leading-[25px] text-grey-50">{title}</p>
      <p className="text-sm text-grey-300">{body}</p>
    </div>
  );
}

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

/** One ranked player. Your own row is outlined in lime. */
function EntryRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <motion.li
      variants={rowVariants}
      className={`flex items-center gap-4 rounded border p-2 ${
        entry.isCurrentUser ? "border-lime-500 bg-lime-100" : "border-grey-300 bg-grey-300"
      }`}
      aria-current={entry.isCurrentUser ? "true" : undefined}
    >
      <span className={`w-8 shrink-0 text-center text-xl leading-7 ${entry.rank <= 3 ? "text-green-950" : "text-grey-700"}`}>
        {entry.rank}
      </span>
      {entry.avatarUrl ? (
        <img
          src={entry.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-10 shrink-0 rounded bg-grey-50 object-cover"
        />
      ) : (
        <PixelChicken look={PODIUM_LOOKS[entry.rank] ?? PLAIN_CHICKEN} size={40} className="rounded" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-paragraph leading-5 text-grey-950">
          {entry.displayName}
          {entry.isCurrentUser && <span className="ml-2 rounded bg-lime-400 px-1 text-2xs text-green-950">You</span>}
        </p>
        <p className="text-xs leading-[15px] text-grey-700">
          {entry.restartCount} {entry.restartCount === 1 ? "retry" : "retries"} · {entry.commandCount} commands
        </p>
      </div>
      <span className="shrink-0 font-secondary text-code leading-5 text-grey-950">{formatDuration(entry.elapsedMs)}</span>
    </motion.li>
  );
}

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}
