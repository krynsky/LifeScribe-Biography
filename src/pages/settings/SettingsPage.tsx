import { useState, useEffect } from "react";
import { CheckCircle, Loader2, RefreshCw, LogOut, ExternalLink } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { getApiKey, saveApiKey } from "@/lib/ai-curator";
import {
  getSyncToken, getSyncUrl, saveSyncCredentials, clearSyncCredentials,
  isSyncConfigured, getSyncMode, setSyncMode,
  makeSyncService, type SyncMode, type ConflictItem,
} from "@/lib/sync";
import { testConnection, type RemoteProfile } from "@/lib/sync/web-profile";
import { copyReferencedPhotosIntoLibrary } from "@/lib/actions/library";

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

  // Claude API key
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Sync settings
  const [syncToken, setSyncToken] = useState("");
  const [syncUrl, setSyncUrl] = useState("");
  const [syncProfile, setSyncProfile] = useState<RemoteProfile | null>(null);
  const [syncConnecting, setSyncConnecting] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number; conflicts: string[] } | null>(null);
  const [mode, setMode] = useState<SyncMode>(getSyncMode());
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [unpublished, setUnpublished] = useState<Array<{ entity_type: string; local_id: number }>>([]);

  useEffect(() => {
    setApiKey(getApiKey());
    setSyncToken(getSyncToken());
    setSyncUrl(getSyncUrl());
    if (isSyncConfigured()) {
      testConnection()
        .then(setSyncProfile)
        .catch(() => setSyncProfile(null));
      makeSyncService().listUnpublished().then(setUnpublished).catch(() => {});
    }
  }, []);

  function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    saveApiKey(apiKey.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!syncToken.trim()) return;
    setSyncConnecting(true);
    setSyncError("");
    saveSyncCredentials(syncToken.trim(), syncUrl.trim() || undefined);
    try {
      const profile = await testConnection();
      setSyncProfile(profile);
    } catch (err) {
      setSyncError(String(err));
      clearSyncCredentials();
    } finally {
      setSyncConnecting(false);
    }
  }

  function handleDisconnect() {
    clearSyncCredentials();
    setSyncProfile(null);
    setSyncToken("");
    setSyncError("");
  }

  function handleModeChange(m: SyncMode) {
    setSyncMode(m);
    setMode(m);
  }

  async function handleRefresh() {
    setSyncing(true);
    setSyncResult(null);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const summary = await svc.refresh((msg) => setSyncStatus(msg));
      setConflicts(summary.conflicts);
      setUnpublished(await svc.listUnpublished());
      setSyncResult({ pushed: 0, pulled: summary.created + summary.updated, conflicts: summary.conflicts.map((c) => `${c.entity_type}:${c.remote_id}`) });
      setSyncStatus(`Refreshed — ${summary.created} new, ${summary.updated} updated, ${summary.deleted} removed, ${summary.conflicts.length} conflicts`);
    } catch (err) {
      setSyncStatus("Refresh failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleResetRefresh() {
    setSyncing(true);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const summary = await svc.reset((msg) => setSyncStatus(msg));
      setSyncStatus(`Reset complete — ${summary.created + summary.updated} records refreshed from web`);
      setUnpublished(await svc.listUnpublished());
    } catch (err) {
      setSyncStatus("Reset failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handlePublishAll() {
    setSyncing(true);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const items = await svc.listUnpublished();
      const res = await svc.publish(items, (msg) => setSyncStatus(msg));
      setUnpublished(await svc.listUnpublished());
      setSyncStatus(`Published ${res.published} item${res.published === 1 ? "" : "s"}${res.errors.length ? ` · ${res.errors.length} failed` : ""}`);
    } catch (err) {
      setSyncStatus("Publish failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        {/* Claude API Key */}
        <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            AI Curation (Anthropic Claude)
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Provide your Anthropic API key to enable AI-powered content curation from notes and journal entries.
            Your key is stored locally on your device only.
          </p>
          <form onSubmit={handleSaveApiKey} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
                style={{ background: "var(--color-primary)" }}
              >
                {apiKeySaved && <CheckCircle size={14} />}
                {apiKeySaved ? "Saved!" : "Save API Key"}
              </button>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm"
                style={{ color: "var(--color-primary)" }}
              >
                Get an API key <ExternalLink size={12} />
              </a>
            </div>
          </form>
        </div>

        {/* LifeScribe.us Sync */}
        <div className="p-6 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Sync to LifeScribe.us
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Optionally publish your biography to the web by connecting your LifeScribe.us account.
            Your data stays local — sync is opt-in only.
          </p>

          {syncProfile ? (
            /* Connected */
            <div className="space-y-4">
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: "var(--color-primary)" + "10", borderColor: "var(--color-primary)" + "40" }}
              >
                <CheckCircle size={16} style={{ color: "var(--color-primary)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
                    Connected as {syncProfile.display_name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{syncProfile.email}</div>
                  <a
                    href={`https://lifescribe.us/${syncProfile.site.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs mt-0.5"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {syncProfile.site.title} <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Source of truth</label>
                  <select
                    value={mode}
                    onChange={(e) => handleModeChange(e.target.value as SyncMode)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    <option value="web-master">Web is master</option>
                    <option value="app-master">App is master</option>
                    <option value="standalone">Standalone (no sync)</option>
                  </select>
                </div>

                {mode !== "standalone" && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleRefresh} disabled={syncing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60"
                      style={{ background: "var(--color-primary)" }}>
                      {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {syncing ? "Working…" : "Refresh from web"}
                    </button>
                    <button onClick={handlePublishAll} disabled={syncing || unpublished.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border font-medium disabled:opacity-50"
                      style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                      title="Push your unpublished local edits to the web">
                      Publish{unpublished.length ? ` (${unpublished.length})` : ""}
                    </button>
                    <button onClick={handleResetRefresh} disabled={syncing}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                      title="Discard local copies of web content and re-pull everything fresh">
                      Reset &amp; re-pull
                    </button>
                    <button onClick={handleDisconnect}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                      <LogOut size={13} /> Disconnect
                    </button>
                  </div>
                )}

                {conflicts.length > 0 && (
                  <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--color-border)" }}>
                    <div className="font-medium mb-1" style={{ color: "var(--color-text)" }}>
                      {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"} — edited on both sides
                    </div>
                    <div style={{ color: "var(--color-text-muted)" }}>
                      Resolve by either re-pulling (keep web) or publishing (keep your version) the affected items.
                    </div>
                  </div>
                )}
              </div>

              {syncStatus && (
                <div className="text-xs flex items-center gap-2" style={{ color: syncResult ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                  {syncing && <Loader2 size={11} className="animate-spin" />}
                  {syncResult && !syncing && <CheckCircle size={11} />}
                  {syncStatus}
                </div>
              )}
            </div>
          ) : (
            /* Not connected */
            <form onSubmit={handleConnect} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={syncToken}
                  onChange={(e) => setSyncToken(e.target.value)}
                  placeholder="ls_pat_…"
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
                <div className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                  Generate a token at lifescribe.us → Account → API Tokens
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  API URL <span style={{ color: "var(--color-text-muted)" }}>(optional)</span>
                </label>
                <input
                  type="url"
                  value={syncUrl}
                  onChange={(e) => setSyncUrl(e.target.value)}
                  placeholder="https://lifescribe.us/api/v1"
                  className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                />
              </div>
              {syncError && (
                <div className="text-xs p-2 rounded-lg" style={{ background: "var(--color-error)" + "18", color: "var(--color-error)" }}>
                  {syncError}
                </div>
              )}
              <button
                type="submit"
                disabled={syncConnecting || !syncToken.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
                style={{ background: "var(--color-primary)" }}
              >
                {syncConnecting && <Loader2 size={13} className="animate-spin" />}
                {syncConnecting ? "Connecting…" : "Connect Account"}
              </button>
            </form>
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
              <dd style={{ color: "var(--color-text)" }}>0.1.0</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: "var(--color-text-secondary)" }}>Data location</dt>
              <dd className="font-mono text-xs" style={{ color: "var(--color-text)" }}>%LOCALAPPDATA%\LifeScribe\</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
