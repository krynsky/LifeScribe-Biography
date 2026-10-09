import { useEffect, useState } from "react";
import { createCategory, listCategories, type CategoryRow } from "@/lib/actions/taxonomy";
import { CATEGORY_COLORS } from "@/lib/category-colors";

interface CategoryPickerProps {
  value: number | null;
  onChange: (categoryId: number | null) => void;
  label?: string;
}

const COLORS = CATEGORY_COLORS;

/** Choose one shared category, or create a new one inline. Categories are shared by every section. */
export default function CategoryPicker({ value, onChange, label = "Category" }: CategoryPickerProps) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLORS[1]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(console.error);
  }, []);

  async function handleCreate() {
    setError(null);
    try {
      const created = await createCategory({ name, color });
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(created.id);
      setCreating(false);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const fieldStyle = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>
        {label}
      </label>
      {creating ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="New category name"
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={fieldStyle}
          />
          <div className="flex items-center gap-1.5" role="group" aria-label="Category color">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full border-2"
                style={{ background: c, borderColor: color === c ? "var(--color-text)" : "transparent" }}
              />
            ))}
          </div>
          {error && <p className="text-xs" style={{ color: "var(--color-error)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleCreate()} disabled={!name.trim()} className="px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: "var(--color-primary)" }}>
              Add category
            </button>
            <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 px-3 py-2 rounded-lg border text-sm"
            style={fieldStyle}
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setCreating(true)} className="px-3 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
            New…
          </button>
        </div>
      )}
    </div>
  );
}
