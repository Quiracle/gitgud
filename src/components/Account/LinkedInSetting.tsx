import { useState } from "react";
import { useLinkedInStatus } from "../../hooks/useLinkedInStatus";
import { useI18n } from "../../i18n/I18nProvider";
import { linkedInService, type LinkedInStatus } from "../../services/linkedin";
import type { TranslationKey } from "../../i18n/translate";
import { Button } from "../Button/Button";

/**
 * Account settings row for the LinkedIn connection, so players can connect before they
 * share and disconnect at any time. Only shown to signed-in players.
 */
export function LinkedInSetting() {
  const { t } = useI18n();
  const linkedIn = useLinkedInStatus();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const status = linkedIn.status;

  async function connect() {
    setBusy(true);
    setNote(undefined);
    try {
      // Leaves for LinkedIn's consent screen and comes back to this page.
      await linkedInService().connect("/account");
    } catch (error) {
      setBusy(false);
      setNote(error instanceof Error ? error.message : t("linkedin.error.generic"));
    }
  }

  async function disconnect() {
    setBusy(true);
    setNote(undefined);
    try {
      await linkedInService().disconnect();
      linkedIn.set({ state: "disconnected" });
    } catch (error) {
      setNote(error instanceof Error ? error.message : t("linkedin.error.disconnectFailed"));
    } finally {
      setBusy(false);
    }
  }

  const canConnect = status.state === "disconnected";
  const connected = status.state === "connected";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-paragraph text-grey-950">{t("account.linkedIn")}</p>
          <p className="truncate text-xs text-grey-600">
            {status.state === "connected" && status.name
              ? t("account.linkedIn.connectedAs", { name: status.name })
              : t(detailKey(status))}
          </p>
        </div>
        {(canConnect || connected) && (
          <Button variant="outline" fullWidth={false} disabled={busy} onClick={connected ? disconnect : connect}>
            {t(connected ? "account.linkedIn.disconnect" : "account.linkedIn.connect")}
          </Button>
        )}
      </div>
      {note && (
        <p className="text-xs text-red-700" role="alert">
          {note}
        </p>
      )}
    </div>
  );
}

function detailKey(status: LinkedInStatus): TranslationKey {
  switch (status.state) {
    case "loading":
      return "common.loading";
    case "connected":
      return "account.linkedIn.connected";
    case "disconnected":
      return status.expired ? "account.linkedIn.expired" : "account.linkedIn.notConnected";
    default:
      return "account.linkedIn.unavailable";
  }
}
