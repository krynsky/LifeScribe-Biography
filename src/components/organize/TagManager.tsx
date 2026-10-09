import { useCallback, useEffect, useState } from "react";
import { Merge, Pencil, Trash2 } from "lucide-react";
import { deleteTag, listTags, mergeTag, renameTag, type TagRow } from "@/lib/actions/taxonomy";

type Row = TagRow & { usage: number };

const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

/** Rename, merge and delete the tags used on stories and albums. New tags are created where you tag something. */
export default function TagManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [mergingId, setMergingId] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => setRows(await listTags()), []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const unused = rows.filter((t) => t.usage === 0).length;

  return (
    <section className="rounded-xl border p-5" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
      <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>Tags</h2>
      <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--color-text-muted)" }}>
        Tags are added when you edit a story or album. Rename them, merge duplicates, or remove ones you no longer use.
        {unused > 0 && ` ${unused} unused.`}
      </p>

      {error && <p className="text-xs mb-3" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No tags yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="group px-3 py-2 rounded-lg border" style={{ borderColor: "var(--color-border)" }}>
              {renamingId === t.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await renameTag(t.id, renameText);
                      setRenamingId(null);
                    });
                  }}
                >
                  <input autoFocus aria-label="New tag name" value={renameText} onChange={(e) => setRenameText(e.target.value)} className="flex-1 px-2 py-1 rounded border text-sm" style={field} />
                  <button type="submit" className="px-3 py-1 rounded text-sm text-white" style={{ background: "var(--color-primary)" }}>Save</button>
                  <button type="button" onClick={() => setRenamingId(null)} className="px-3 py-1 rounded text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>Cancel</button>
                </form>
              ) : mergingId === t.id ? (
                <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
                  <span>Merge “{t.name}” into</span>
                  <select aria-label="Merge into" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value ? Number(e.target.value) : "")} className="px-2 py-1 rounded border text-sm" style={field}>
                    <option value="">Choose a tag…</option>
                    {rows.filter((o) => o.id !== t.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <button
                    disabled={mergeTarget === ""}
                    onClick={() => void run(async () => {
                      if (mergeTarget === "") return;
                      await mergeTag(t.id, mergeTarget);
                      setMergingId(null);
                    })}
                    className="px-3 py-1 rounded text-sm text-white disabled:opacity-50"
                    style={{ background: "var(--color-primary)" }}
                  >
                    Merge
                  </button>
                  <button onClick={() => setMergingId(null)} className="px-3 py-1 rounded text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex-1 min-w-0 text-sm" style={{ color: "var(--color-text)" }}>
                    {t.name}
                    <span className="ml-2 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      {t.usage === 0 ? "Unused" : `${t.usage} use${t.usage === 1 ? "" : "s"}`}
                    </span>
                  </span>
                  <span className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button onClick={() => { setRenamingId(t.id); setRenameText(t.name); setMergingId(null); }} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Rename" aria-label={`Rename ${t.name}`}><Pencil size={13} /></button>
                    {rows.length > 1 && (
                      <button onClick={() => { setMergingId(t.id); setMergeTarget(""); setRenamingId(null); }} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Merge into another tag" aria-label={`Merge ${t.name}`}><Merge size={13} /></button>
                    )}
                    <button
                      onClick={() => {
                        const msg = t.usage > 0 ? `Delete the tag "${t.name}"? It will be removed from ${t.usage} item${t.usage === 1 ? "" : "s"}.` : `Delete the tag "${t.name}"?`;
                        if (confirm(msg)) void run(() => deleteTag(t.id));
                      }}
                      className="p-1.5 rounded"
                      style={{ color: "var(--color-error)" }}
                      title="Delete"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
