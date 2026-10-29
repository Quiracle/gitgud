import { motion } from "motion/react";
import { Button } from "../components/Button/Button";
import { useDailyCompletion } from "../hooks/useDailyCompletion";
import { useDailyPuzzle } from "../hooks/useDailyPuzzle";
import { useI18n } from "../i18n/I18nProvider";
import { localizePuzzle } from "../puzzles/localization";
import { SolveScreen } from "./SolveScreen";

interface DailyPuzzleScreenProps {
  onNavigate: (path: string) => void;
}

export function DailyPuzzleScreen({ onNavigate }: DailyPuzzleScreenProps) {
  const { t, locale } = useI18n();
  const daily = useDailyPuzzle();
  const synced = useDailyCompletion(daily.status === "ready" ? daily.puzzle : undefined);

  if (daily.status === "ready" && !synced.loading) {
    // Keyed by puzzle only: the solve itself saves a completion, and remounting then would
    // reopen the run as already solved and skip the celebration.
    return (
      <SolveScreen
        key={`${daily.puzzle.id}:${daily.puzzle.version}`}
        puzzle={localizePuzzle(daily.puzzle, locale)}
        syncedCompletion={synced.completion}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <main className="fixed inset-0 flex flex-col bg-green-950">
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-green-900 px-8 text-center">
        {daily.status === "loading" || daily.status === "ready" ? (
          <motion.p
            className="font-secondary text-code text-grey-400"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            {t("daily.loading")}
          </motion.p>
        ) : (
          <div className="flex max-w-xs flex-col items-center gap-4">
            <p className="text-sm text-grey-200">{daily.message}</p>
            <Button variant="outline" fullWidth={false} onClick={() => void daily.reload()}>
              {t("common.tryAgain")}
            </Button>
            <Button variant="outline" fullWidth={false} href="/" onNavigate={onNavigate}>
              {t("common.backHome")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
