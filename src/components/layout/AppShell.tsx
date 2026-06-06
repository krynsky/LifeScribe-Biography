import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { getDb } from "@/lib/db";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((err) => setDbError(String(err)));
  }, []);

  if (dbError) {
    return (
      <div
        className="flex h-full items-center justify-center p-8"
        style={{ background: "var(--color-background)" }}
      >
        <div
          className="max-w-md p-6 rounded-xl border text-center"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
        >
          <div
            className="text-lg font-semibold mb-2"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-error)" }}
          >
            Database Error
          </div>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
            {dbError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg text-sm text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ background: "var(--color-background)" }}
      >
        <div className="text-center">
          <div
            className="text-base mb-2"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
          >
            LifeScribe
          </div>
          <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "var(--color-background)" }}>
      <Sidebar />

      {/* Main content area */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ background: "var(--color-background)" }}
      >
        {children}
      </main>
    </div>
  );
}
