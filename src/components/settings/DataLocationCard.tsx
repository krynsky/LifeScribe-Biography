import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getDataLocation, unavailableMessage, type DataLocation } from "@/lib/data-location";
import { checkTargetFolder, moveDataTo } from "@/lib/data-move-run";
import { looksCloudSynced } from "@/lib/data-move";

/** Settings card: shows where the app keeps its data and lets the user move it to another folder. */
export default function DataLocationCard() {
  const [loc, setLoc] = useState<DataLocation | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);

  useEffect(() => {
    getDataLocation().then(setLoc).catch((e) => setError(String(e)));
  }, []);

  async function handleChoose() {
    setError(null);
    setStatus(null);
    const picked = await open({ directory: true, multiple: false, title: "Choose a folder for your LifeScribe data" });
    if (!picked || typeof picked !== "string") return;

    setBusy(true);
    try {
      const check = await checkTargetFolder(picked);
      if (check.error) {
        setError(check.error);
        return;
      }
      if (looksCloudSynced(picked)) {
        const ok = confirm(
          "That folder looks like it is synced by a cloud service (OneDrive, Dropbox, Google Drive…).\n\n" +
            "Syncing the database file while the app is using it can corrupt your data. A plain folder on a local or external drive is safer.\n\n" +
            "Use it anyway?"
        );
        if (!ok) return;
      }

      if (check.hasData) {
        const ok = confirm(
          `That folder already contains LifeScribe data:\n${picked}\n\nThe app will start using it after a restart. Nothing in it will be overwritten, and your current data stays where it is.\n\nSwitch to it?`
        );
        if (!ok) return;
        const result = await moveDataTo(picked, true, setStatus);
        setStatus(`Ready. After restarting, the app will use ${result.newRoot}.`);
      } else {
        const ok = confirm(
          `Copy all of your data to this folder?\n${picked}\n\nYour database, images, imported photos and backups are copied. Your current data is not deleted, so you keep a safety copy. The app switches to the new folder after a restart.`
        );
        if (!ok) return;
        const result = await moveDataTo(picked, false, setStatus);
        setStatus(
          result.kind === "moved"
            ? `Copied ${result.filesCopied} files to ${result.newRoot}. Restart to start using it. Your previous data was left in place.`
            : `Ready. After restarting, the app will use ${result.newRoot}.`
        );
      }
      setNeedsRestart(true);
    } catch (err) {
      setError(`Could not change the data folder: ${String(err)}`);
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const row = "flex flex-col gap-0.5";
  const mono = "font-mono text-xs break-all";

  return (
    <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Data location
      </h2>
      <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
        Everything you create lives in one place: your database, images, imported photos and backups. You can keep it on
        another drive or in a folder of your choice.
      </p>

      {loc && (
        <dl className="space-y-3 mb-4 text-sm">
          <div className={row}>
            <dt style={{ color: "var(--color-text-secondary)" }}>{loc.custom ? "Custom folder" : "Default location"}</dt>
            <dd className={mono} style={{ color: "var(--color-text)" }}>{loc.filesRoot}</dd>
          </div>
          <div className={row}>
            <dt style={{ color: "var(--color-text-secondary)" }}>Database file</dt>
            <dd className={mono} style={{ color: "var(--color-text)" }}>{loc.dbPath}</dd>
          </div>
          {!loc.available && (
            <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{unavailableMessage(loc)}</p>
          )}
        </dl>
      )}

      <p className="text-sm mb-4 p-3 rounded-lg" style={{ background: "var(--color-surface-2)", color: "var(--color-text-secondary)" }}>
        <strong style={{ color: "var(--color-text)" }}>Backing up:</strong> close LifeScribe, then copy this whole folder to another
        drive or storage. Closing the app first makes sure the copy is complete. To restore, put the copy back in this
        folder (or choose it with <em>Choose folder…</em>).
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={handleChoose}
          disabled={busy || !loc}
          className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
          style={{ background: "var(--color-primary)" }}
        >
          {busy ? "Working…" : "Choose folder…"}
        </button>
        {needsRestart && (
          <button
            onClick={() => void invoke("restart_app")}
            className="px-4 py-2 rounded-lg text-sm border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            Restart now
          </button>
        )}
      </div>

      {status && <p className="text-sm mt-3 break-all" style={{ color: "var(--color-text-secondary)" }}>{status}</p>}
      {error && <p className="text-sm mt-3" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
    </div>
  );
}
