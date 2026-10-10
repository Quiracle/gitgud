import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { canShareFile, copyImage, downloadImage, linkedInShareUrl, shareFileName, shareText, type ShareSummary } from "../../lib/share";
import { renderShareCard } from "../../lib/shareCard";
import type { PublicPuzzleDefinition } from "../../puzzles";
import { Button } from "../Button/Button";
import { chickenLookFromState } from "../Illustration/PixelChicken";
import { Icon } from "../Icon/Icon";
import { Dialog } from "../Puzzle/Dialog";

/** Shown in the share card footer, like the site footer. */
const SITE = "gitgudgame.lol";

/** What a finished daily run contributes to the card. */
export interface ShareableResult {
  elapsedMs: number;
  restartCount: number;
  assisted: boolean;
}

interface ShareCard {
  summary: ShareSummary;
  blob: Blob;
  file: File;
  /** Object URL for the preview; revoked when the card changes. */
  url: string;
}

/**
 * Sharing for a solved daily. The card is drawn as soon as there is a result, so the
 * share sheet can open straight from the tap (iOS needs the user's gesture). Phones use
 * the share sheet; elsewhere `dialog` offers copy, download, and LinkedIn.
 * Only dailies are shareable: `available` stays false for lessons and unsolved runs.
 */
export function useResultShare(puzzle: PublicPuzzleDefinition | undefined, result: ShareableResult | null) {
  const summary: ShareSummary | null =
    puzzle?.kind === "daily" && puzzle.publishedOn && result
      ? { publishedOn: puzzle.publishedOn, difficulty: puzzle.difficulty, ...result }
      : null;
  const { t } = useI18n();
  const card = useShareCard(summary, puzzle);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    if (!card) return;
    if (canShareFile(card.file)) {
      try {
        await navigator.share({ files: [card.file], text: shareText(card.summary, window.location.origin) });
      } catch {
        // Closing the share sheet rejects; there is nothing to report.
      }
      return;
    }
    setNote(null);
    setOpen(true);
  }

  async function copy() {
    if (!card) return;
    const copied = await copyImage(card.blob);
    setNote(copied ? t("share.copied") : t("share.copyUnsupported"));
  }

  const dialog: ReactNode = (
    <Dialog open={open && Boolean(card)} title={t("result.share")} onClose={() => setOpen(false)}>
      {card && (
        <img
          src={card.url}
          alt={t("share.cardAlt")}
          className="aspect-square w-full rounded"
        />
      )}
      <div className="flex flex-col gap-2">
        <Button onClick={copy}>
          <Icon name="content_copy" size={20} className="mr-2" />
          {t("share.copy")}
        </Button>
        <Button variant="outline" onClick={() => card && downloadImage(card.blob, card.file.name)}>
          <Icon name="download" size={20} className="mr-2" />
          {t("share.download")}
        </Button>
        <Button
          variant="outline"
          onClick={() => window.open(linkedInShareUrl(window.location.origin), "_blank", "noopener,noreferrer")}
        >
          <Icon name="open_in_new" size={20} className="mr-2" />
          {t("share.linkedIn")}
        </Button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={note ?? "default"}
          className="text-xs text-grey-400"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          aria-live="polite"
        >
          {note ?? t("share.help")}
        </motion.p>
      </AnimatePresence>
    </Dialog>
  );

  return { available: Boolean(card), share, open: open && Boolean(card), dialog };
}

function useShareCard(summary: ShareSummary | null, puzzle: PublicPuzzleDefinition | undefined): ShareCard | null {
  const { locale } = useI18n();
  const [card, setCard] = useState<ShareCard | null>(null);
  // The card is drawn with words, so a language change redraws it.
  const key = summary && puzzle ? JSON.stringify([summary, puzzle.id, puzzle.version, locale]) : null;

  useEffect(() => {
    if (!summary || !puzzle) return;
    let cancelled = false;
    let url: string | undefined;
    renderShareCard({ ...summary, look: chickenLookFromState(puzzle.target.snapshot), site: SITE })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ summary, blob, file: new File([blob], shareFileName(summary.publishedOn), { type: blob.type }), url });
      })
      .catch(() => {
        // No card, no share button: sharing must never get in the way of finishing.
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setCard(null);
    };
    // The summary is rebuilt every render; its contents are what matter.
  }, [key]);

  return card;
}

/** Compact outline "Share" button that sits beside another control. */
export function ShareButton({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <Button variant="outline" fullWidth={false} onClick={onClick} className={`shrink-0 ${className}`}>
      <Icon name="share" size={20} className="mr-2" />
      {t("share.button")}
    </Button>
  );
}
