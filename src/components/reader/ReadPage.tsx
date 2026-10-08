import type { ReactNode } from "react";

interface ReadPageProps {
  title?: string;
  subtitle?: string;
  /** Widths follow the public site: story prose is narrow, timeline/career medium, galleries full. */
  width?: "narrow" | "timeline" | "wide" | "full";
  children: ReactNode;
}

const WIDTHS = {
  narrow: "max-w-2xl",
  timeline: "max-w-4xl",
  wide: "max-w-5xl",
  full: "max-w-6xl",
} as const;

/** Shared page frame for read-mode views, mirroring the lifescribe.us public bio layout. */
export default function ReadPage({ title, subtitle, width = "wide", children }: ReadPageProps) {
  return (
    <div className={`mx-auto px-6 py-10 ${WIDTHS[width]}`}>
      {title && (
        <header className="mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>
              {subtitle}
            </p>
          )}
        </header>
      )}
      {children}
    </div>
  );
}

export function ReadLoading() {
  return (
    <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
      Loading…
    </div>
  );
}
