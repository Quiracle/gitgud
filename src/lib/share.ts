import { currentLocale, t } from "../i18n/runtime";
import type { PuzzleDifficulty } from "../puzzles/types";
import { formatDuration } from "./format";

export interface ShareSummary {
  /** Canonical UTC date of the daily puzzle, YYYY-MM-DD. */
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

/** LinkedIn only takes a URL here; the image has to be attached in the composer. */
export function linkedInShareUrl(url: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

export function shareFileName(publishedOn: string): string {
  return `gitgud-${publishedOn}.png`;
}

/** Phones hand the image straight to the share sheet; most desktop browsers can't. */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
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
