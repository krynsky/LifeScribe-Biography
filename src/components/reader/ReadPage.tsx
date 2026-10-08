import type { ReactNode } from "react";

interface ReadPageProps {
  title?: string;
  subtitle?: string;
  /** "narrow" for long-form reading, "wide" for card grids. */
  width?: "narrow" | "wide";
  children: ReactNode;
}

/** Shared page frame for read-mode views, mirroring the lifescribe.us public bio layout. */
export default function ReadPage({ title, subtitle, width = "wide", children }: ReadPageProps) {
  return (
    <div className={`mx-auto px-8 py-10 ${width === "narrow" ? "max-w-3xl" : "max-w-5xl"}`}>
      {title && (
        <header className="mb-8">
          <h1 className="text-3xl" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
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
