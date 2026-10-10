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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DIFFICULTY: Record<PuzzleDifficulty, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

/** "10 Oct 2026". Read straight from the string so no timezone can shift the day. */
export function formatPuzzleDate(publishedOn: string): string {
  const [year, month, day] = publishedOn.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function retriesLabel(count: number): string {
  return `${count} ${count === 1 ? "retry" : "retries"}`;
}

/** Spoiler-free post text: date, difficulty, time, and retries, never the commands. */
export function shareText(summary: ShareSummary, url: string): string {
  const result = summary.assisted
    ? "solved with help"
    : `solved in ${formatDuration(summary.elapsedMs)} with ${retriesLabel(summary.restartCount)}`;
  return `GitGud daily · ${formatPuzzleDate(summary.publishedOn)}\n${DIFFICULTY[summary.difficulty]} puzzle, ${result}.\nPlay today's puzzle: ${url}`;
}

/**
 * Opens LinkedIn's post composer with the text filled in. The parameters are undocumented;
 * if LinkedIn drops them this still lands on the feed. No link can attach an image (that needs
 * LinkedIn API permissions), so the image is copied first and pasted by the player.
 */
export function linkedInComposeUrl(text: string): string {
  return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
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
