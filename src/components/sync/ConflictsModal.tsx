import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { makeSyncService, type ConflictItem } from "@/lib/sync";
import { SqlDataStore } from "@/lib/sync/data-store";
import { entityLabel } from "@/lib/sync/registry";
import { diffFields, type FieldDiff } from "@/lib/sync/compare";
import { createBackup } from "@/lib/backup";

const SECTION_NAMES: Record<string, string> = {
  story: "Story",
  milestone: "Milestone",
  career: "Career entry",
  map_pin: "Place",
  family_member: "Family member",
  album: "Album",
  biography: "Profile",
};

interface Row {
  conflict: ConflictItem;
  label: string;
  diffs: FieldDiff[];
}

interface ConflictsModalProps {
  open: boolean;
  conflicts: ConflictItem[];
  onClose: () => void;
  /** Called with the conflicts that are still unresolved, after any change. */
  onChanged: (remaining: ConflictItem[]) => void;
}

/**
 * Records edited both in the app and on the website since the last sync. For each one, compare the two
 * versions and choose: keep yours (publishes it over the website's) or use the website's (replaces yours).
 */
export default function ConflictsModal({ open, conflicts, onClose, onChanged }: ConflictsModalProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    const store = new SqlDataStore();
    Promise.all(
      conflicts.map(async (c) => {
        const local = await store.getLocal(c.entity_type, c.local_id);
        const fields = local?.fields ?? {};
        return { conflict: c, label: entityLabel(c.entity_type, fields), diffs: c.remote ? diffFields(c.entity_type, fields, c.remote.fields) : [] };
      })
    )
      .then(setRows)
      .catch((e) => setMessage({ text: String(e), tone: "error" }));
  }, [open, conflicts]);

  const keyOf = (c: ConflictItem) => `${c.entity_type}:${c.local_id}`;

  async function resolve(c: ConflictItem, choice: "mine" | "web") {
    setBusyKey(keyOf(c));
    setMessage(null);
    try {
      // A safety copy first: choosing the website's version replaces your text.
      await createBackup(`before-resolve-${choice}`).catch((e) => console.error("Backup failed:", e));
      const res = await makeSyncService().resolveConflict(c, choice);
      if (res.ok) {
        const remaining = conflicts.filter((x) => keyOf(x) !== keyOf(c));
        setMessage({ text: choice === "mine" ? "Your version is now on the website." : "Your copy now matches the website.", tone: "ok" });
        onChanged(remaining);
      } else {
        setMessage({ text: res.error ?? "That did not work.", tone: "error" });
      }
    } catch (e) {
      setMessage({ text: String(e), tone: "error" });
    } finally {
      setBusyKey(null);
    }
  }

  const pre = "text-sm whitespace-pre-wrap break-words";

  return (
    <Modal open={open} onClose={busyKey ? () => {} : onClose} title="Edited in both places" maxWidth="760px">
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-sm mb-4" style={{ color: "var(--color-text-secondary)" }}>
          These were changed in the app and on your website since the last sync. Nothing has been overwritten. Pick which version to keep for each one.
        </p>

        {message && (
          <p className="text-sm mb-3" style={{ color: message.tone === "error" ? "var(--color-error)" : "var(--color-success)" }} role="status">
            {message.text}
          </p>
        )}

        {conflicts.length === 0 && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Nothing left to resolve.</p>}
        {!rows && conflicts.length > 0 && <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading both versions…</p>}

        <div className="space-y-5">
          {(rows ?? []).filter((r) => conflicts.some((c) => keyOf(c) === keyOf(r.conflict))).map((r) => (
            <section key={keyOf(r.conflict)} className="rounded-xl border p-4" style={{ borderColor: "var(--color-border)" }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--color-text)" }}>
                {SECTION_NAMES[r.conflict.entity_type] ?? r.conflict.entity_type}: {r.label}
              </h3>

              {r.diffs.length === 0 ? (
                <p className="text-sm mb-3" style={{ color: "var(--color-text-secondary)" }}>
                  The text is the same on both sides. The difference is in details such as photos or links.
                </p>
              ) : (
                <div className="space-y-3 mb-3">
                  <div className="grid grid-cols-2 gap-3 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                    <span>In the app (yours)</span>
                    <span>On the website</span>
                  </div>
                  {r.diffs.map((d) => (
                    <div key={d.key}>
                      <div className="text-xs mb-1" style={{ color: "var(--color-text-secondary)" }}>{d.label}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg p-2" style={{ background: "var(--color-surface-2)" }}>
                          <div className={pre} style={{ color: "var(--color-text)" }}>{d.mine || <em style={{ color: "var(--color-text-muted)" }}>(empty)</em>}</div>
                        </div>
                        <div className="rounded-lg p-2" style={{ background: "var(--color-surface-2)" }}>
                          <div className={pre} style={{ color: "var(--color-text)" }}>{d.web || <em style={{ color: "var(--color-text-muted)" }}>(empty)</em>}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void resolve(r.conflict, "mine")}
                  disabled={busyKey !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50"
                  style={{ background: "var(--color-primary)" }}
                >
                  {busyKey === keyOf(r.conflict) && <Loader2 size={12} className="animate-spin" />}
                  Keep mine and publish it
                </button>
                <button
                  onClick={() => void resolve(r.conflict, "web")}
                  disabled={busyKey !== null}
                  className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-50"
                  style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
                >
                  Use the website’s version
                </button>
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
        <button onClick={onClose} disabled={busyKey !== null} className="px-4 py-2 rounded-lg text-sm border disabled:opacity-50" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
          Close
        </button>
      </div>
    </Modal>
  );
}
