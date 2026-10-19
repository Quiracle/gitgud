import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useLinkedInStatus } from "../../hooks/useLinkedInStatus";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translate";
import { copyImage, downloadImage, linkedInComposeUrl, shareFileName, shareText, xComposeUrl, type ShareSummary } from "../../lib/share";
import { renderShareCard } from "../../lib/shareCard";
import type { PublicPuzzleDefinition } from "../../puzzles";
import {
  LinkedInError,
  linkedInService,
  rememberShareToResume,
  takeShareToResume,
  type LinkedInStatus,
} from "../../services/linkedin";
import { LoginDialog } from "../Auth/LoginDialog";
import { Button } from "../Button/Button";
import { chickenLookFromState } from "../Illustration/PixelChicken";
import { Icon } from "../Icon/Icon";
import { Dialog } from "../Puzzle/Dialog";

/** Shown in the share card footer, like the site footer. */
const SITE = "gitgudgame.lol";
const CAPTION_LIMIT = 3000;

/** What a finished daily run contributes to the card. */
export interface ShareableResult {
  elapsedMs: number;
  restartCount: number;
  assisted: boolean;
}

interface ShareCard {
  summary: ShareSummary;
  /** Stable `puzzleId@version`: what the post is about and which dialog to reopen. */
  key: string;
  puzzleId: string;
  puzzleVersion: number;
  blob: Blob;
  file: File;
  /** Object URL for the preview; revoked when the card changes. */
  url: string;
}

type PostState =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "posted"; postUrl: string };

/**
 * Sharing for a solved daily. The card is drawn as soon as there is a result, so the
 * share sheet can open straight from the tap (iOS needs the user's gesture).
 *
 * Share opens a dialog with LinkedIn, X, and download. With LinkedIn configured, the
 * LinkedIn button posts the card through the linkedin-share Edge Function: the player sees
 * the image and caption and taps Post; nothing is ever posted without that tap. Without it,
 * and always for X, the image is copied and the network's composer opens for pasting.
 * Only dailies are shareable: `available` stays false for lessons and unsolved runs.
 */
export function useResultShare(puzzle: PublicPuzzleDefinition | undefined, result: ShareableResult | null) {
  const summary: ShareSummary | null =
    puzzle?.kind === "daily" && puzzle.publishedOn && result
      ? { publishedOn: puzzle.publishedOn, difficulty: puzzle.difficulty, ...result }
      : null;
  const { t } = useI18n();
  const card = useShareCard(summary, puzzle);
  const linkedIn = useLinkedInStatus(Boolean(card));
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [post, setPost] = useState<PostState>({ kind: "idle" });
  const captionId = useId();
  const usesApi = linkedIn.status.state !== "unavailable";

  // A fresh card (another result, or another language) means a fresh caption and nothing posted yet.
  useEffect(() => {
    setCaption(card ? shareText(card.summary, window.location.origin) : "");
    setPost({ kind: "idle" });
  }, [card?.url]);

  // Back from LinkedIn's consent screen or from logging in: reopen where the player left off.
  useEffect(() => {
    if (card && takeShareToResume(card.key)) {
      setNote(null);
      setOpen(true);
    }
  }, [card?.key]);

  function share() {
    if (!card) return;
    setNote(null);
    setOpen(true);
  }

  /** No API can attach the image here, so copy it and open the composer with the text filled in. */
  async function openComposer(network: "linkedin" | "x") {
    if (!card) return;
    setNote(null);
    // Copy before opening the tab: the clipboard refuses writes once this page loses focus.
    // The write is quick, so the tap still counts as the gesture that allows the new tab.
    const copied = await copyImage(card.blob);
    if (network === "x") setNote(copied ? t("share.x.copied") : t("share.x.copyUnsupported"));
    else setNote(copied ? t("share.copied") : t("share.copyUnsupported"));
    const text = shareText(card.summary, window.location.origin);
    window.open(network === "x" ? xComposeUrl(text) : linkedInComposeUrl(text), "_blank", "noopener,noreferrer");
  }

  async function linkedInAction() {
    if (!card || post.kind === "busy") return;
    const status = linkedIn.status;
    if (status.state === "loading") return;
    if (post.kind === "posted") {
      window.open(post.postUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (status.state === "signed-out") {
      rememberShareToResume(card.key);
      setOpen(false);
      setLoginOpen(true);
      return;
    }
    setNote(null);
    setPost({ kind: "busy" });
    try {
      if (status.state === "connected") {
        const posted = await linkedInService().post({
          puzzleId: card.puzzleId,
          puzzleVersion: card.puzzleVersion,
          text: caption.trim(),
          image: card.blob,
        });
        setPost({ kind: "posted", postUrl: posted.postUrl });
        setNote(t("share.linkedIn.posted"));
      } else {
        // Leaves the page for LinkedIn's consent screen; the dialog reopens on return.
        rememberShareToResume(card.key);
        await linkedInService().connect(window.location.pathname);
      }
    } catch (error) {
      setPost({ kind: "idle" });
      setNote(error instanceof Error ? error.message : t("linkedin.error.generic"));
      if (error instanceof LinkedInError) {
        if (error.code === "not_connected") linkedIn.set({ state: "disconnected", expired: true });
        if (error.code === "signed_out") linkedIn.set({ state: "signed-out" });
        if (error.code === "unavailable") linkedIn.set({ state: "unavailable" });
      }
      // The connect redirect never happened, so don't reopen the dialog later.
      takeShareToResume(card.key);
    }
  }

  async function disconnect() {
    setNote(null);
    try {
      await linkedInService().disconnect();
      linkedIn.set({ state: "disconnected" });
      setNote(t("share.linkedIn.disconnected"));
    } catch (error) {
      setNote(error instanceof Error ? error.message : t("linkedin.error.disconnectFailed"));
    }
  }

  const status = linkedIn.status;
  const captionInvalid = !caption.trim() || caption.length > CAPTION_LIMIT;

  const dialog: ReactNode = (
    <>
      <Dialog open={open && Boolean(card)} title={t("result.share")} onClose={() => setOpen(false)}>
        {card && (
          <img
            src={card.url}
            alt={t("share.cardAlt")}
            className="aspect-square w-full rounded"
          />
        )}
        {status.state === "connected" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={captionId} className="text-sm text-grey-300">
              {t("share.caption")}
            </label>
            <textarea
              id={captionId}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              disabled={post.kind !== "idle"}
              maxLength={CAPTION_LIMIT}
              rows={4}
              className="w-full resize-none rounded border border-lime-400 bg-green-900 p-3 text-base text-grey-50 outline-none transition-colors duration-200 focus:border-lime-300 focus:outline focus:outline-1 focus:-outline-offset-2 focus:outline-lime-300 disabled:text-grey-400"
            />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button
            onClick={usesApi ? linkedInAction : () => openComposer("linkedin")}
            disabled={
              usesApi &&
              (status.state === "loading" ||
                post.kind === "busy" ||
                (status.state === "connected" && post.kind === "idle" && captionInvalid))
            }
          >
            <Icon name="linkedin" size={20} className="mr-2" />
            {t(usesApi ? linkedInLabel(status, post) : "share.linkedIn")}
          </Button>
          <Button variant="outline" onClick={() => openComposer("x")}>
            <Icon name="x" size={20} className="mr-2" />
            {t("share.x.post")}
          </Button>
          <Button variant="outline" onClick={() => card && downloadImage(card.blob, card.file.name)}>
            <Icon name="download" size={20} className="mr-2" />
            {t("share.download")}
          </Button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={note ?? status.state}
            className="text-xs text-grey-400"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            aria-live="polite"
          >
            {note ?? t(statusNote(status))}
          </motion.p>
        </AnimatePresence>
        {status.state === "connected" && (
          <p className="-mt-4 flex flex-wrap items-center gap-x-1 text-xs text-grey-400">
            {status.name ? t("share.linkedIn.postingAs", { name: status.name }) : t("share.linkedIn.connected")}
            <button
              type="button"
              onClick={disconnect}
              disabled={post.kind === "busy"}
              className="min-h-11 text-lime-400 underline underline-offset-2 hover:text-lime-300"
            >
              {t("share.linkedIn.disconnect")}
            </button>
          </p>
        )}
      </Dialog>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath={window.location.pathname} />
    </>
  );

  return { available: Boolean(card), share, open: open && Boolean(card), dialog };
}

function linkedInLabel(status: LinkedInStatus, post: PostState): TranslationKey {
  if (post.kind === "posted") return "share.linkedIn.viewPost";
  if (status.state === "loading") return "share.linkedIn.checking";
  if (status.state === "signed-out") return "share.linkedIn.logIn";
  if (status.state === "connected") return post.kind === "busy" ? "share.linkedIn.posting" : "share.linkedIn.post";
  return post.kind === "busy" ? "share.linkedIn.opening" : "share.linkedIn.connect";
}

function statusNote(status: LinkedInStatus): TranslationKey {
  switch (status.state) {
    case "connected":
      return "share.linkedIn.publicNote";
    case "disconnected":
      return status.expired ? "share.linkedIn.expiredNote" : "share.linkedIn.connectNote";
    case "signed-out":
      return "share.linkedIn.signedOutNote";
    case "loading":
      return "share.linkedIn.loadingNote";
    default:
      return status.reason ? "share.linkedIn.unavailableNote" : "share.help";
  }
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
        setCard({
          summary,
          key: `${puzzle.id}@${puzzle.version}`,
          puzzleId: puzzle.id,
          puzzleVersion: puzzle.version,
          blob,
          file: new File([blob], shareFileName(summary.publishedOn), { type: blob.type }),
          url,
        });
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
