import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Secure storage implementation in U7
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        {/* Claude API Key */}
        <div
          className="p-6 rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            AI Curation (Anthropic Claude)
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Provide your own Anthropic API key to enable AI-powered content curation. Your key is stored encrypted on your device.
          </p>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                className="w-full px-3 py-2 rounded-lg border text-sm font-mono"
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-sm text-white font-medium"
                style={{ background: "var(--color-primary)" }}
              >
                {saved ? "Saved!" : "Save API Key"}
              </button>
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm"
                style={{ color: "var(--color-primary)" }}
              >
                Get an API key →
              </a>
            </div>
          </form>
        </div>

        {/* LifeScribe.us Sync */}
        <div
          className="p-6 rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            Sync to LifeScribe.us
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            Optionally connect your account to publish your biography to the web. Sync implementation in U9.
          </p>
          <button
            disabled
            className="px-4 py-2 rounded-lg text-sm text-white font-medium opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            Connect Account
          </button>
        </div>

        {/* App info */}
        <div
          className="p-6 rounded-xl border"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
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
              <dd className="font-mono text-xs" style={{ color: "var(--color-text)" }}>
                %LOCALAPPDATA%\LifeScribe\
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
