import { useEffect, useState } from "react";
import {
  getStoryLinkIds,
  listLinkableEntries,
  setStoryLinks,
  type LinkableEntry,
  type StoryLinkKind,
} from "@/lib/actions/related";

const GROUPS: { kind: StoryLinkKind; title: string; icon: string; empty: string }[] = [
  { kind: "milestones", title: "Timeline", icon: "📅", empty: "No milestones yet." },
  { kind: "albums", title: "Gallery", icon: "🖼️", empty: "No albums yet." },
  { kind: "mapPins", title: "Places", icon: "📍", empty: "No places yet." },
  { kind: "career", title: "Career", icon: "💼", empty: "No career entries yet." },
];

/** Link this story to milestones, albums, places and career entries. Changes save immediately. */
export default function RelatedEntriesPanel({ storyId }: { storyId: number }) {
  const [options, setOptions] = useState<Record<StoryLinkKind, LinkableEntry[]> | null>(null);
  const [selected, setSelected] = useState<Record<StoryLinkKind, number[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listLinkableEntries(), getStoryLinkIds(storyId)])
      .then(([o, s]) => {
        setOptions(o);
        setSelected(s);
      })
      .catch((e) => setError(String(e)));
  }, [storyId]);

  async function toggle(kind: StoryLinkKind, id: number) {
    if (!selected) return;
    const next = selected[kind].includes(id) ? selected[kind].filter((x) => x !== id) : [...selected[kind], id];
    const previous = selected;
    setSelected({ ...selected, [kind]: next });
    try {
      await setStoryLinks(storyId, kind, next);
      setError(null);
    } catch (e) {
      setSelected(previous); // roll back so the checkbox matches what was saved
      setError(`Could not save: ${String(e)}`);
    }
  }

  if (!options || !selected) return null;

  return (
    <section className="mt-8 rounded-xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
      <h2 className="text-sm font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--color-text-secondary)" }}>
        Related entries
      </h2>
      <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
        Tick anything this story is about. Related entries are listed under the story and link back to it.
      </p>
      {error && (
        <p className="text-xs mb-3" style={{ color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <fieldset key={g.kind}>
            <legend className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
              {g.icon} {g.title}
              {selected[g.kind].length > 0 && (
                <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-muted)" }}>
                  ({selected[g.kind].length})
                </span>
              )}
            </legend>
            {options[g.kind].length === 0 ? (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {g.empty}
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {options[g.kind].map((o) => (
                  <label key={o.id} className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
                    <input type="checkbox" className="mt-1" checked={selected[g.kind].includes(o.id)} onChange={() => void toggle(g.kind, o.id)} />
                    <span>
                      {o.label}
                      {o.detail && <span style={{ color: "var(--color-text-muted)" }}> · {o.detail}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </div>
    </section>
  );
}
