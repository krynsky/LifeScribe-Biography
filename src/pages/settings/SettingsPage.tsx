import { useState } from "react";
import { useAppVersion } from "@/lib/app-version";
import PageHeader from "@/components/ui/PageHeader";
import { copyReferencedPhotosIntoLibrary } from "@/lib/actions/library";
import { createBackup } from "@/lib/backup";
import DataLocationCard from "@/components/settings/DataLocationCard";

export default function SettingsPage() {
  // Photo library migration
  const [libraryStatus, setLibraryStatus] = useState<string | null>(null);
  const [libraryBusy, setLibraryBusy] = useState(false);

  async function handleCopyPhotos() {
    setLibraryBusy(true);
    setLibraryStatus("Copying…");
    try {
      const r = await copyReferencedPhotosIntoLibrary((done, total) => setLibraryStatus(`Copying ${done} of ${total}…`));
      setLibraryStatus(`Done — ${r.copied} copied, ${r.alreadyInLibrary} already in the library, ${r.missing} could not be found.`);
    } catch (err) {
      setLibraryStatus("Failed: " + String(err));
    } finally {
      setLibraryBusy(false);
    }
  }

  // Database backup
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  async function handleBackup() {
    setBackupBusy(true);
    setBackupStatus("Backing up…");
    try {
      const path = await createBackup("manual");
      setBackupStatus(`Backup saved to ${path}`);
    } catch (err) {
      setBackupStatus("Backup failed: " + String(err));
    } finally {
      setBackupBusy(false);
    }
  }

  const version = useAppVersion();

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        <DataLocationCard />

        {/* Backup */}
        <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Back up your data
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Save a snapshot of your whole biography (stories, timeline, family tree, everything except the image files).
            The newest 10 backups are kept in the app's data folder. To keep a copy somewhere else, also copy that folder and the images folder next to it.
          </p>
          <button
            onClick={handleBackup}
            disabled={backupBusy}
            className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            Back up now
          </button>
          {backupStatus && (
            <p className="text-sm mt-3 break-all" style={{ color: "var(--color-text-secondary)" }}>{backupStatus}</p>
          )}
        </div>

        {/* Photo library */}
        <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Photo library
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            New photos and images are copied into the app so your biography keeps working if the originals move. Photos imported
            earlier still point at their original files — copy them in here.
          </p>
          <button
            onClick={handleCopyPhotos}
            disabled={libraryBusy}
            className="px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            Copy existing photos into the app
          </button>
          {libraryStatus && (
            <p className="text-sm mt-3" style={{ color: "var(--color-text-secondary)" }}>{libraryStatus}</p>
          )}
        </div>

        {/* App info */}
        <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-semibold mb-3" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            About
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: "var(--color-text-secondary)" }}>Version</dt>
              <dd style={{ color: "var(--color-text)" }}>{version}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
