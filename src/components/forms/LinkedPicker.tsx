import { X } from "lucide-react";
import type { LinkTarget } from "@/lib/actions/entity-links";

interface LinkedPickerProps {
  label: string;
  emoji: string;
  options: LinkTarget[];
  value: number[];
  onChange: (ids: number[]) => void;
  emptyHint: string;
  tone?: "story" | "album";
}

const TONES = {
  story: { border: "var(--color-accent)", bg: "var(--color-surface-2)", color: "var(--color-primary-dark)" },
  album: { border: "#a7f3d0", bg: "#ecfdf5", color: "#047857" },
} as const;

/** Link this record to stories or albums: chips for what's linked, plus a menu to add more. */
export default function LinkedPicker({ label, emoji, options, value, onChange, emptyHint, tone = "story" }: LinkedPickerProps) {
  const t = TONES[tone];
  const linked = value.map((id) => options.find((o) => o.id === id)).filter((o): o is LinkTarget => !!o);
  const available = options.filter((o) => !value.includes(o.id));

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {emoji} {label}
      </label>
      {linked.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {linked.map((o) => (
            <span key={o.id} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium" style={{ borderColor: t.border, background: t.bg, color: t.color }}>
              {o.label}
              <button type="button" aria-label={`Unlink ${o.label}`} onClick={() => onChange(value.filter((id) => id !== o.id))}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {options.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{emptyHint}</p>
      ) : (
        <select
          value=""
          onChange={(e) => e.target.value && onChange([...value, Number(e.target.value)])}
          disabled={available.length === 0}
          aria-label={`Add ${label.toLowerCase()}`}
          className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-50"
          style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
        >
          <option value="">{available.length === 0 ? "Everything is linked" : `Add ${label.toLowerCase()}…`}</option>
          {available.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
