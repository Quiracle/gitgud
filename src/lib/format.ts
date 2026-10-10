import { t } from "../i18n/runtime";

/** "3m 55s", as in the Figma result popup, in the active language. */
export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes ? t("duration.minutes", { minutes, seconds }) : t("duration.seconds", { seconds });
}
