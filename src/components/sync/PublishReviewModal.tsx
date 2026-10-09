import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { makeSyncService, type UnpublishedItem } from "@/lib/sync";
import { createBackup } from "@/lib/backup";

const SECTION_TITLES: Record<string, string> = {
  story: "Stories",
  milestone: "Timeline",
  career: "Career",
  map_pin: "Places",
  family_member: "Family",
  album: "Albums",
  biography: "Profile",
};
const SECTION_ORDER = ["biography", "story", "milestone", "career", "map_pin", "family_member", "album"];

const keyOf = (i: { entity_type: string; local_id: number }) => `${i.entity_type}:${i.local_id}`;

interface PublishReviewModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a publish attempt so the caller can refresh its counts. */
  onFinished: () => void;
}

/**
 * Review what will be sent to the website, untick anything you'd rather keep local, and publish.
 * A database backup is taken first; if it can't be made, nothing is published.
 */
export default function PublishReviewModal({ open, onClose, onFinished }: PublishReviewModalProps) {
  const [items, setItems] = useState<UnpublishedItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ published: number; errors: string[]; photos?: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setItems(null);
    setResult(null);
    setLoadError(null);
    setProgress("");
    makeSyncService()
      .listUnpublished()
      .then((list) => {
        setItems(list);
        setSelected(new Set(list.map(keyOf)));
      })
      .catch((e) => setLoadError(String(e)));
  }, [open]);

  const groups = useMemo(() => {
    const by = new Map<string, UnpublishedItem[]>();
    for (const it of items ?? []) by.set(it.entity_type, [...(by.get(it.entity_type) ?? []), it]);
    return SECTION_ORDER.filter((t) => by.has(t)).map((t) => ({ type: t, items: by.get(t)! }));
  }, [items]);

  const labelFor = (token: string) => items?.find((i) => keyOf(i) === token)?.label;

  function toggle(it: UnpublishedItem) {
    const next = new Set(selected);
    const k = keyOf(it);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelected(next);
  }

  function setGroup(type: string, on: boolean) {
    const next = new Set(selected);
    for (const it of items ?? []) if (it.entity_type === type) (on ? next.add(keyOf(it)) : next.delete(keyOf(it)));
    setSelected(next);
  }

  async function publish() {
    if (!items) return;
    const chosen = items.filter((i) => selected.has(keyOf(i)));
    if (chosen.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      setProgress("Backing up your data first…");
      try {
        await createBackup("before-publish");
      } catch (e) {
        setResult({ published: 0, errors: [`Nothing was published, because a safety backup could not be made: ${String(e)}`] });
        return;
      }
      const res = await makeSyncService().publish(chosen, (msg) => setProgress(msg));
      setResult(res);
    } catch (e) {
      setResult({ published: 0, errors: [String(e)] });
    } finally {
      setProgress("");
      setBusy(false);
      onFinished();
    }
  }

  const newCount = (items ?? []).filter((i) => selected.has(keyOf(i)) && i.kind === "new").length;
  const changedCount = (items ?? []).filter((i) => selected.has(keyOf(i)) && i.kind === "changed").length;

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Review and publish" maxWidth="640px">
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {loadError && <p className="text-sm" style={{ color: "var(--color-error)" }}>{loadError}</p>}
        {!items && !loadError && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Checking what has changed…</p>}

        {items && items.length === 0 && !result && (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>Everything is up to date with your website.</p>
        )}

        {items && items.length > 0 && !result && (
          <>
            <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
              These will be sent to your website. <strong>New</strong> items are created there; <strong>changed</strong> items update the version on your site. Untick anything you want to keep local for now.
              Text, dates, categories, tags, links, family relationships and photos are sent. Photos from this computer are uploaded to your website, so publishing photos can take a while.
            </p>
            <div className="space-y-4">
              {groups.map((g) => (
                <section key={g.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                      {SECTION_TITLES[g.type] ?? g.type} <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>({g.items.length})</span>
                    </h3>
                    <span className="text-xs space-x-2" style={{ color: "var(--color-primary)" }}>
                      <button type="button" onClick={() => setGroup(g.type, true)}>All</button>
                      <button type="button" onClick={() => setGroup(g.type, false)}>None</button>
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((it) => (
                      <li key={keyOf(it)}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
                          <input type="checkbox" checked={selected.has(keyOf(it))} onChange={() => toggle(it)} />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate">{it.label}</span>
                            {it.warning && (
                              <span className="block text-xs" style={{ color: "#B45309" }}>⚠ {it.warning}</span>
                            )}
                          </span>
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-full"
                            style={{ background: it.kind === "new" ? "#4A9B6F22" : "var(--color-surface-2)", color: it.kind === "new" ? "var(--color-success)" : "var(--color-text-secondary)" }}
                          >
                            {it.kind === "new" ? "New" : "Changed"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3" role="status">
            <p className="text-sm font-medium" style={{ color: result.published > 0 ? "var(--color-success)" : "var(--color-text)" }}>
              Published {result.published} item{result.published === 1 ? "" : "s"}
              {result.photos ? ` and uploaded ${result.photos} photo${result.photos === 1 ? "" : "s"}` : ""}.
            </p>
            {result.errors.length > 0 && (
              <div>
                <p className="text-sm mb-1" style={{ color: "var(--color-error)" }}>
                  {result.errors.length} could not be published:
                </p>
                <ul className="text-xs space-y-1 list-disc pl-4" style={{ color: "var(--color-text-secondary)" }}>
                  {result.errors.map((e, i) => {
                    const m = e.match(/^(\w+):(\d+)(.*)$/);
                    const label = m ? labelFor(`${m[1]}:${m[2]}`) : null;
                    return <li key={i}>{label ? `${label}${m![3]}` : e}</li>;
                  })}
                </ul>
                <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>
                  Items marked “web changed” were edited on the website since your last refresh. Refresh from web, then publish again.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
        {!result && items && items.length > 0 && (
          <button
            onClick={() => void publish()}
            disabled={busy || selected.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {busy ? "Publishing…" : `Publish ${selected.size} item${selected.size === 1 ? "" : "s"}${newCount || changedCount ? ` (${newCount} new, ${changedCount} changed)` : ""}`}
          </button>
        )}
        <button onClick={onClose} disabled={busy} className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
          {result ? "Close" : "Cancel"}
        </button>
        {progress && <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{progress}</span>}
      </div>
    </Modal>
  );
}
