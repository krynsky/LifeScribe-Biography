import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { listTags, type TagRow } from "@/lib/actions/taxonomy";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
}

/** Add tags by typing (Enter or comma) or picking an existing one; new names are created on save. */
export default function TagPicker({ value, onChange, label = "Tags" }: TagPickerProps) {
  const [all, setAll] = useState<TagRow[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    listTags().then(setAll).catch(console.error);
  }, []);

  const has = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase());

  function add(raw: string) {
    const name = raw.trim().replace(/,+$/, "").trim();
    if (!name || has(name)) {
      setInput("");
      return;
    }
    // Reuse the stored spelling when the tag already exists.
    const existing = all.find((t) => t.name.toLowerCase() === name.toLowerCase());
    onChange([...value, existing?.name ?? name]);
    setInput("");
  }

  const suggestions = input.trim()
    ? all.filter((t) => t.name.toLowerCase().includes(input.trim().toLowerCase()) && !has(t.name)).slice(0, 6)
    : [];

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-primary)" }}>
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            if (e.target.value.endsWith(",")) add(e.target.value);
            else setInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => input.trim() && add(input)}
          placeholder={value.length === 0 ? "Add a tag…" : ""}
          className="flex-1 min-w-[8rem] px-1 py-0.5 text-sm bg-transparent outline-none"
          style={{ color: "var(--color-text)" }}
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {suggestions.map((t) => (
            <button
              key={t.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(t.name)}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
            >
              + {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
