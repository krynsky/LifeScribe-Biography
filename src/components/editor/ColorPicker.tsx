import { useEffect, useRef, useState } from "react";

// Same palette as the web editor so colors round-trip between app and site.
export const EDITOR_COLORS = [
  { label: "Black", hex: "#000000" },
  { label: "Dark Gray", hex: "#6b7280" },
  { label: "Red", hex: "#dc2626" },
  { label: "Orange", hex: "#ea580c" },
  { label: "Yellow", hex: "#ca8a04" },
  { label: "Green", hex: "#16a34a" },
  { label: "Blue", hex: "#2563eb" },
  { label: "Purple", hex: "#9333ea" },
  { label: "Pink", hex: "#db2777" },
] as const;

interface ColorPickerProps {
  icon: React.ReactNode;
  currentColor: string | null;
  /** null clears the color. */
  onSelect: (hex: string | null) => void;
  title: string;
}

export default function ColorPicker({ icon, currentColor, onSelect, title }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        // Keep the editor selection while the palette opens.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 flex flex-col items-center justify-center rounded"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {icon}
        <span className="block h-0.5 w-4 rounded mt-0.5" style={{ background: currentColor ?? "var(--color-border)" }} />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 p-2 rounded-lg border shadow-lg"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", width: 132 }}
        >
          <div className="grid grid-cols-5 gap-1.5">
            {EDITOR_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                aria-label={c.label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(c.hex);
                  setOpen(false);
                }}
                className="w-5 h-5 rounded-full border"
                style={{ background: c.hex, borderColor: currentColor === c.hex ? "var(--color-text)" : "var(--color-border)" }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="mt-2 w-full text-xs py-1 rounded border"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            Remove color
          </button>
        </div>
      )}
    </div>
  );
}
