import { t } from "../i18n/runtime";
import { parsePublicPuzzleDefinition } from "../puzzles/schema";
import type { DailyPuzzleSource } from "./dailyPuzzles";

/** Local developer review only. Files are produced by pnpm daily:review, never shipped. */
export class ReviewDailyPuzzleSource implements DailyPuzzleSource {
  constructor(private readonly template: string, private readonly request: typeof fetch = fetch) {
    if (!/^(easy|medium|hard)-\d+$/.test(template)) throw new Error("Invalid VITE_DAILY_REVIEW_TEMPLATE.");
  }

  async getByDate(_date: string) {
    const response = await this.request(`/daily-review.local/${this.template}.json`);
    if (!response.ok) throw new Error(t("daily.unavailable"));
    const parsed = parsePublicPuzzleDefinition(await response.json());
    if (!parsed.puzzle) throw new Error(t("daily.invalid"));
    // Separate review progress from any official date or another template.
    return { ...parsed.puzzle, id: `review-${this.template}`, slug: `review-${this.template}` };
  }
}
