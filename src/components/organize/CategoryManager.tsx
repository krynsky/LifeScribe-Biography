import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createCategory, deleteCategory, listCategories, updateCategory, type CategoryRow } from "@/lib/actions/taxonomy";
import { CATEGORY_COLORS } from "@/lib/category-colors";

type Row = CategoryRow & { usage: number };

interface FormValues {
  name: string;
  icon: string;
  color: string | null;
}

const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

function CategoryForm({ initial, submitLabel, onSubmit, onCancel }: { initial: FormValues; submitLabel: string; onSubmit: (v: FormValues) => Promise<void>; onCancel?: () => void }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return setError("Enter a name.");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      if (!onCancel) setValues({ name: "", icon: "", color: initial.color }); // reset the "add" form
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <input
          aria-label="Category name"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          placeholder="Category name"
          maxLength={50}
          className="flex-1 px-3 py-2 rounded-lg border text-sm"
          style={field}
        />
        <input
          aria-label="Icon (emoji)"
          value={values.icon}
          onChange={(e) => setValues({ ...values, icon: e.target.value })}
          placeholder="Icon"
          maxLength={4}
          className="w-20 px-3 py-2 rounded-lg border text-sm text-center"
          style={field}
        />
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Color">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={values.color === c}
            onClick={() => setValues({ ...values, color: c })}
            className="w-6 h-6 rounded-full border-2"
            style={{ background: c, borderColor: values.color === c ? "var(--color-text)" : "transparent" }}
          />
        ))}
        <button
          type="button"
          aria-pressed={values.color === null}
          onClick={() => setValues({ ...values, color: null })}
          className="ml-1 text-xs px-2 py-1 rounded border"
          style={{ borderColor: values.color === null ? "var(--color-text)" : "var(--color-border)", color: "var(--color-text-secondary)" }}
        >
          No color
        </button>
      </div>
      {error && <p className="text-xs" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** Create, recolor, rename and delete the categories shared by stories, timeline, career, places and albums. */
export default function CategoryManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => setRows(await listCategories()), []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  async function handleDelete(c: Row) {
    const msg =
      c.usage > 0
        ? `Delete "${c.name}"? It is used by ${c.usage} item${c.usage === 1 ? "" : "s"}, which will lose their category. This cannot be undone.`
        : `Delete "${c.name}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    setError(null);
    try {
      await deleteCategory(c.id);
      await reload();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>Categories</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--color-text-muted)" }}>
        One set of categories is shared by stories, timeline, career, places and albums.
      </p>

      <div className="mb-5 pb-5 border-b" style={{ borderColor: "var(--color-border)" }}>
        <h3 className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "var(--color-text)" }}><Plus size={14} /> New category</h3>
        <CategoryForm
          initial={{ name: "", icon: "", color: CATEGORY_COLORS[1] }}
          submitLabel="Add category"
          onSubmit={async (v) => {
            await createCategory({ name: v.name, icon: v.icon.trim() || null, color: v.color });
            await reload();
          }}
        />
      </div>

      {error && <p className="text-xs mb-3" style={{ color: "var(--color-error)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No categories yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="p-3 rounded-lg border" style={{ borderColor: "var(--color-primary)" }}>
                <CategoryForm
                  initial={{ name: c.name, icon: c.icon ?? "", color: c.color }}
                  submitLabel="Save"
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (v) => {
                    await updateCategory(c.id, { name: v.name, icon: v.icon.trim() || null, color: v.color });
                    setEditingId(null);
                    await reload();
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: c.color ?? "#E5E7EB" }} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{c.icon ? `${c.icon} ` : ""}{c.name}</span>
                  <span className="block text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {c.usage === 0 ? "Not used yet" : `Used by ${c.usage} item${c.usage === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => setEditingId(c.id)} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${c.name}`}><Pencil size={13} /></button>
                  <button onClick={() => void handleDelete(c)} className="p-1.5 rounded" style={{ color: "var(--color-error)" }} title="Delete" aria-label={`Delete ${c.name}`}><Trash2 size={13} /></button>
                </span>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
