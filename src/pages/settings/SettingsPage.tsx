import { useState } from "react";
import { useAppVersion } from "@/lib/app-version";
import PageHeader from "@/components/ui/PageHeader";
import DataLocationCard from "@/components/settings/DataLocationCard";

export default function SettingsPage() {
  const version = useAppVersion();

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Settings" />

      <div className="space-y-6">
        <DataLocationCard />

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
