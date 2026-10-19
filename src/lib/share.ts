import { currentLocale, t } from "../i18n/runtime";
import type { PuzzleDifficulty } from "../puzzles/types";
import { formatDuration } from "./format";

export interface ShareSummary {
  /** Canonical date of the daily puzzle, YYYY-MM-DD. */
  publishedOn: string;
  difficulty: PuzzleDifficulty;
  elapsedMs: number;
  restartCount: number;
  /** The solution was revealed: no time is claimed. */
  assisted: boolean;
}

/** "10 Oct 2026" in the active language. Formatted in UTC so no timezone can shift the day. */
export function formatPuzzleDate(publishedOn: string): string {
  const [year, month, day] = publishedOn.split("-").map(Number);
  const locale = currentLocale();
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(Date.UTC(year, month - 1, day));
}

export function retriesLabel(count: number): string {
  return t("leaderboard.retries", { count });
}

/** Spoiler-free post text: date, difficulty, time, and retries, never the commands. */
export function shareText(summary: ShareSummary, url: string): string {
  const result = summary.assisted
    ? t("share.solvedWithHelp")
    : t("share.solvedIn", { time: formatDuration(summary.elapsedMs), retries: retriesLabel(summary.restartCount) });
  return [
    t("share.heading", { date: formatPuzzleDate(summary.publishedOn) }),
    t("share.result", { difficulty: t(`difficulty.${summary.difficulty}`), result }),
    t("share.cta", { url }),
  ].join("\n");
}

/**
 * Opens LinkedIn's post composer with the text filled in. The parameters are undocumented;
 * if LinkedIn drops them this still lands on the feed. No link can attach an image (that needs
 * LinkedIn API permissions), so the image is copied first and pasted by the player.
 */
export function linkedInComposeUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
}

/** Opens X's post composer with the text filled in. Like LinkedIn, the image is pasted by the player. */
export function xComposeUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

export function shareFileName(publishedOn: string): string {
  return `gitgud-${publishedOn}.png`;
}

export async function copyImage(blob: Blob): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadImage(blob: Blob, fileName: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}
