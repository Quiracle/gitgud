import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { canShareFile, copyImage, downloadImage, linkedInComposeUrl, shareFileName, shareText, type ShareSummary } from "../../lib/share";
import { renderShareCard } from "../../lib/shareCard";
import type { PublicPuzzleDefinition } from "../../puzzles";
import { isSupabaseConfigured } from "../../services/supabase";
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

const PASTE_NOTE = "Image copied. Paste it into your LinkedIn post (Ctrl+V or ⌘V).";
const COPY_FAILED_NOTE = "This browser can't copy images. Download it, then add it to your LinkedIn post.";

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
 * With LinkedIn configured, Share opens a dialog that posts the card to LinkedIn through
 * the linkedin-share Edge Function: the player sees the image and caption and taps Post;
 * nothing is ever posted without that tap. Without it, phones use the share sheet and
 * desktops copy the image and open LinkedIn's composer.
 * Only dailies are shareable: `available` stays false for lessons and unsolved runs.
 */
export function useResultShare(puzzle: PublicPuzzleDefinition | undefined, result: ShareableResult | null) {
  const summary: ShareSummary | null =
    puzzle?.kind === "daily" && puzzle.publishedOn && result
      ? { publishedOn: puzzle.publishedOn, difficulty: puzzle.difficulty, ...result }
      : null;
  const card = useShareCard(summary, puzzle);
  const linkedIn = useLinkedInStatus(Boolean(card));
  const [open, setOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [post, setPost] = useState<PostState>({ kind: "idle" });
  const captionId = useId();
  const usesApi = linkedIn.status.state !== "unavailable";
  const phone = card ? canShareFile(card.file) : false;

  // A fresh card means a fresh caption and nothing posted yet.
  useEffect(() => {
    setCaption(card ? shareText(card.summary, window.location.origin) : "");
    setPost({ kind: "idle" });
  }, [card?.key]);

  // Back from LinkedIn's consent screen or from logging in: reopen where the player left off.
  useEffect(() => {
    if (card && takeShareToResume(card.key)) {
      setNote(null);
      setOpen(true);
    }
  }, [card?.key]);

  async function share() {
    if (!card) return;
    setNote(null);
    if (usesApi) {
      setOpen(true);
      return;
    }
    if (phone) {
      await openShareSheet();
      return;
    }
    setOpen(true);
    // Copy before opening the tab: the clipboard refuses writes once this page loses focus.
    // The write is quick, so the tap still counts as the gesture that allows the new tab.
    const copied = await copyImage(card.blob);
    setNote(copied ? PASTE_NOTE : COPY_FAILED_NOTE);
    openLinkedInComposer(card.summary);
  }

  async function openShareSheet() {
    if (!card) return;
    try {
      await navigator.share({ files: [card.file], text: caption || shareText(card.summary, window.location.origin) });
    } catch {
      // Closing the share sheet rejects; there is nothing to report.
    }
  }

  async function copy() {
    if (!card) return;
    const copied = await copyImage(card.blob);
    setNote(copied ? PASTE_NOTE : COPY_FAILED_NOTE);
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
        setNote("Posted to LinkedIn.");
      } else {
        // Leaves the page for LinkedIn's consent screen; the dialog reopens on return.
        rememberShareToResume(card.key);
        await linkedInService().connect(window.location.pathname);
      }
    } catch (error) {
      setPost({ kind: "idle" });
      setNote(error instanceof Error ? error.message : "LinkedIn didn't respond. Please try again.");
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
      setNote("LinkedIn disconnected.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "LinkedIn couldn't be disconnected. Please try again.");
    }
  }

  const status = linkedIn.status;
  const captionInvalid = !caption.trim() || caption.length > CAPTION_LIMIT;

  const dialog: ReactNode = (
    <>
      <Dialog open={open && Boolean(card)} title="Share result" onClose={() => setOpen(false)}>
        {card && (
          <img
            src={card.url}
            alt="Your result card: today's chicken, difficulty, time, and retries"
            className="aspect-square w-full rounded"
          />
        )}
        {status.state === "connected" && (
          <div className="flex flex-col gap-2">
            <label htmlFor={captionId} className="text-sm text-grey-300">
              Caption
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
          {usesApi && (
            <Button
              onClick={linkedInAction}
              disabled={
                status.state === "loading" ||
                post.kind === "busy" ||
                (status.state === "connected" && post.kind === "idle" && captionInvalid)
              }
            >
              <Icon name={post.kind === "posted" ? "open_in_new" : "share"} size={20} className="mr-2" />
              {linkedInLabel(status, post)}
            </Button>
          )}
          {phone ? (
            <Button variant="outline" onClick={openShareSheet}>
              <Icon name="share" size={20} className="mr-2" />
              Share to other apps
            </Button>
          ) : (
            <Button variant="outline" onClick={copy}>
              <Icon name="content_copy" size={20} className="mr-2" />
              Copy image
            </Button>
          )}
          <Button variant="outline" onClick={() => card && downloadImage(card.blob, card.file.name)}>
            <Icon name="download" size={20} className="mr-2" />
            Download image
          </Button>
          {!usesApi && (
            <Button variant="outline" onClick={() => card && openLinkedInComposer(card.summary)}>
              <Icon name="open_in_new" size={20} className="mr-2" />
              Open LinkedIn
            </Button>
          )}
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
            {note ?? statusNote(status)}
          </motion.p>
        </AnimatePresence>
        {status.state === "connected" && (
          <p className="-mt-4 flex flex-wrap items-center gap-x-1 text-xs text-grey-400">
            {status.name ? `Posting as ${status.name}.` : "LinkedIn connected."}
            <button
              type="button"
              onClick={disconnect}
              disabled={post.kind === "busy"}
              className="min-h-11 text-lime-400 underline underline-offset-2 hover:text-lime-300"
            >
              Disconnect
            </button>
          </p>
        )}
      </Dialog>
      <LoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} returnPath={window.location.pathname} />
    </>
  );

  return { available: Boolean(card), share, open: open && Boolean(card), dialog };
}

function linkedInLabel(status: LinkedInStatus, post: PostState): string {
  if (post.kind === "posted") return "View your post";
  if (status.state === "loading") return "Checking LinkedIn…";
  if (status.state === "signed-out") return "Log in to post to LinkedIn";
  if (status.state === "connected") return post.kind === "busy" ? "Posting…" : "Post to LinkedIn";
  return post.kind === "busy" ? "Opening LinkedIn…" : "Connect LinkedIn";
}

function statusNote(status: LinkedInStatus): string {
  switch (status.state) {
    case "connected":
      return "Anyone on LinkedIn can see this post.";
    case "disconnected":
      return status.expired
        ? "Your LinkedIn connection expired. Connect again to post."
        : "Connect LinkedIn once, then post your result card in one tap.";
    case "signed-out":
      return "Log in to post your result card straight to LinkedIn.";
    case "loading":
      return "Post your result card straight to LinkedIn.";
    default:
      return "Copy or download the image, then add it to your LinkedIn post.";
  }
}

function openLinkedInComposer(summary: ShareSummary) {
  window.open(linkedInComposeUrl(shareText(summary, window.location.origin)), "_blank", "noopener,noreferrer");
}

/** Asked once a card exists and again when the player logs in or out. */
function useLinkedInStatus(enabled: boolean) {
  const { status: authStatus } = useAuth();
  const [status, set] = useState<LinkedInStatus>(() => ({ state: isSupabaseConfigured() ? "loading" : "unavailable" }));

  useEffect(() => {
    if (!enabled || authStatus === "loading") return;
    let cancelled = false;
    void linkedInService()
      .status()
      .then((next) => {
        if (!cancelled) set(next);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, authStatus]);

  return { status, set };
}

function useShareCard(summary: ShareSummary | null, puzzle: PublicPuzzleDefinition | undefined): ShareCard | null {
  const [card, setCard] = useState<ShareCard | null>(null);
  const key = summary && puzzle ? JSON.stringify([summary, puzzle.id, puzzle.version]) : null;

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
  return (
    <Button variant="outline" fullWidth={false} onClick={onClick} className={`shrink-0 ${className}`}>
      <Icon name="share" size={20} className="mr-2" />
      Share
    </Button>
  );
}
