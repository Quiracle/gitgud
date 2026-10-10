import {
  CHICKEN_BACKGROUND,
  CHICKEN_OUTLINE,
  chickenPaintLayers,
  type ChickenLook,
} from "../components/Illustration/PixelChicken";
import type { PuzzleDifficulty } from "../puzzles/types";
import { currentLocale, t } from "../i18n/runtime";
import { formatDuration } from "./format";
import { formatPuzzleDate, type ShareSummary } from "./share";

/* Token values from src/styles.css; a canvas can't read Tailwind classes. */
const GREEN_950 = "#050e08";
const LIME_400 = "#9ee82b";
const GREY_50 = "#fafafa";
const GREY_400 = "#a3a3a3";
const PRIMARY = "Outfit, ui-sans-serif, system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const SIZE = 1080;
const PAD = 72;
const PIXEL = 14;
const TILE = 32 * PIXEL;
const TILE_TOP = (SIZE - TILE) / 2;
const COLUMN = PAD + TILE + 56;
const COLUMN_WIDTH = SIZE - PAD - COLUMN;

const LEVEL: Record<PuzzleDifficulty, number> = { easy: 1, medium: 2, hard: 3 };


export interface ShareCardInput extends ShareSummary {
  look: ChickenLook;
  /** Shown in the footer, like the site footer. */
  site: string;
}

/**
 * The 1080 × 1080 result card: the final chicken, difficulty, time, and retries on the
 * game's dark green. Drawn on a canvas so it needs no server and no DOM screenshot.
 */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  // Canvas text silently falls back to system fonts if the web fonts aren't ready.
  await Promise.all(
    [`400 56px Outfit`, `400 32px "IBM Plex Mono"`].map((font) => document.fonts.load(font).catch(() => [])),
  );

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  ctx.fillStyle = GREEN_950;
  ctx.fillRect(0, 0, SIZE, SIZE);

  text(ctx, "GitGud", PAD, PAD + 48, `400 56px ${PRIMARY}`, LIME_400);
  text(ctx, t("shareCard.daily", { date: formatPuzzleDate(input.publishedOn) }), SIZE - PAD, PAD + 44, `400 32px ${MONO}`, GREY_400, "right");

  drawChicken(ctx, input.look, PAD, TILE_TOP);

  drawDifficulty(ctx, input.difficulty, COLUMN, TILE_TOP);
  if (input.assisted) {
    text(ctx, t("shareCard.result"), COLUMN, TILE_TOP + 132, `400 32px ${PRIMARY}`, GREY_400);
    fitted(ctx, t("result.assistedTitle"), COLUMN, TILE_TOP + 216, 72, GREY_50);
  } else {
    text(ctx, t("shareCard.time"), COLUMN, TILE_TOP + 132, `400 32px ${PRIMARY}`, GREY_400);
    fitted(ctx, formatDuration(input.elapsedMs), COLUMN, TILE_TOP + 244, 112, GREY_50);
  }
  text(ctx, t("shareCard.retries"), COLUMN, TILE_TOP + 332, `400 32px ${PRIMARY}`, GREY_400);
  text(ctx, new Intl.NumberFormat(currentLocale()).format(input.restartCount), COLUMN, TILE_TOP + 420, `400 72px ${PRIMARY}`, GREY_50);

  text(ctx, input.site, SIZE - PAD, SIZE - PAD, `400 32px ${MONO}`, LIME_400, "right");

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image."))), "image/png"),
  );
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = "left",
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(value, x, y);
}

/** Large values shrink until they fit the stats column. */
function fitted(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, max: number, color: string) {
  let size = max;
  ctx.font = `400 ${size}px ${PRIMARY}`;
  while (size > 32 && ctx.measureText(value).width > COLUMN_WIDTH) {
    size -= 4;
    ctx.font = `400 ${size}px ${PRIMARY}`;
  }
  text(ctx, value, x, y, ctx.font, color);
}

function drawChicken(ctx: CanvasRenderingContext2D, look: ChickenLook, left: number, top: number) {
  ctx.fillStyle = CHICKEN_BACKGROUND;
  ctx.fillRect(left, top, TILE, TILE);
  for (const { layer, colors } of chickenPaintLayers(look)) {
    layer.rows.forEach((row, index) => {
      for (let x = 0; x < row.length; x++) {
        const role = row[x];
        if (role === " ") continue;
        ctx.fillStyle = colors[role] ?? CHICKEN_OUTLINE;
        ctx.fillRect(left + x * PIXEL, top + (layer.top + index) * PIXEL, PIXEL, PIXEL);
      }
    });
  }
}

/** DifficultyBadge at card scale: grey-50 pill, three bars filled up to the level. */
function drawDifficulty(ctx: CanvasRenderingContext2D, difficulty: PuzzleDifficulty, left: number, top: number) {
  const height = 56;
  const bars = [14, 22, 31];
  const barWidth = 10;
  const gap = 5;
  ctx.font = `400 30px ${PRIMARY}`;
  const label = t(`difficulty.${difficulty}`);
  const width = 16 + bars.length * barWidth + (bars.length - 1) * gap + 14 + ctx.measureText(label).width + 16;

  ctx.fillStyle = GREY_50;
  ctx.fillRect(left, top, width, height);
  bars.forEach((barHeight, index) => {
    const x = left + 16 + index * (barWidth + gap);
    const y = top + height - 12 - barHeight;
    ctx.strokeStyle = GREEN_950;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, barWidth - 3, barHeight - 3);
    if (index < LEVEL[difficulty]) {
      ctx.fillStyle = GREEN_950;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  });
  text(ctx, label, left + 16 + bars.length * barWidth + (bars.length - 1) * gap + 14, top + 38, ctx.font, GREEN_950);
}
