import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import CategoryPicker from "@/components/forms/CategoryPicker";
import DatePrecisionInput from "@/components/forms/DatePrecisionInput";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { getMilestone, createMilestone, updateMilestone, deleteMilestone } from "@/lib/actions/milestones";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";
import type { DatePrecision } from "@/lib/date-parts";

interface MilestoneForm {
  title: string;
  description: string;
  date: string | null;
  precision: DatePrecision;
  hasEnd: boolean;
  endDate: string | null;
  endPrecision: DatePrecision;
  categoryId: number | null;
  imagePath: string | null;
  stories: number[];
  albums: number[];
}

const EMPTY_FORM: MilestoneForm = {
  title: "",
  description: "",
  date: null,
  precision: "day",
  hasEnd: false,
  endDate: null,
  endPrecision: "day",
  categoryId: null,
  imagePath: null,
  stories: [],
  albums: [],
};

const asPrecision = (p: string | null | undefined): DatePrecision => (p === "year" || p === "month" ? p : "day");

/** Add a new milestone, or edit an existing one, on its own page (like a story). */
function MilestoneFormPage({ milestoneId }: { milestoneId: number | null }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<MilestoneForm>(EMPTY_FORM);
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(milestoneId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLinkTargets().then(setTargets).catch(console.error);
    if (milestoneId === null) return;
    Promise.all([getMilestone(milestoneId), getEntityLinks("milestone", milestoneId)])
      .then(([m, links]) => {
        if (!m) return setNotFound(true);
        setForm({
          title: m.title,
          description: m.description ?? "",
          date: m.date,
          precision: asPrecision(m.date_precision),
          hasEnd: !!m.end_date,
          endDate: m.end_date ?? null,
          endPrecision: asPrecision(m.end_date_precision),
          categoryId: m.category_id ?? null,
          imagePath: m.image_path,
          stories: links.stories,
          albums: links.albums,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [milestoneId]);

  const change = (patch: Partial<MilestoneForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setError(null);
  };

  const goBack = () => navigate({ to: "/timeline" });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Give the milestone a title.");
    if (!form.date) return setError("Enter the year (and optionally month and day) it happened.");
    if (form.hasEnd && !form.endDate) return setError("Enter the end date, or turn off “It ended on a different date”.");
    if (form.hasEnd && form.endDate && form.endDate < form.date) return setError("The end date can't be before the start date.");

    setSaving(true);
    setError(null);
    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        date: form.date,
        date_precision: form.precision,
        end_date: form.hasEnd ? form.endDate : null,
        end_date_precision: form.hasEnd ? form.endPrecision : null,
        category_id: form.categoryId,
        image_path: form.imagePath,
      };
      const saved = milestoneId !== null ? await updateMilestone(milestoneId, data) : await createMilestone(data);
      await setEntityLinks("milestone", saved.id, { stories: form.stories, albums: form.albums });
      setDirty(false);
      goBack();
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (milestoneId === null || !confirm(`Delete "${form.title}"? This cannot be undone.`)) return;
    await deleteMilestone(milestoneId);
    goBack();
  }

  function handleCancel() {
    if (dirty && !confirm("Discard your changes?")) return;
    goBack();
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (notFound) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Milestone not found.</div>;

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const label = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          Timeline
        </button>
        <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }} role="status">
          {milestoneId === null ? "New milestone" : dirty ? "Unsaved changes" : "No changes"}
        </span>
        <button type="submit" disabled={saving} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {saving ? "Saving…" : milestoneId === null ? "Add milestone" : "Save changes"}
        </button>
        {milestoneId !== null && (
          <button type="button" onClick={() => void handleDelete()} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--color-error)" }} title="Delete milestone" aria-label="Delete milestone">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <ImagePicker label="Image" allowGallery value={form.imagePath} onChange={(p) => change({ imagePath: p })} emptyHint="No image" />

          <div>
            <input
              autoFocus={milestoneId === null}
              value={form.title}
              onChange={(e) => change({ title: e.target.value })}
              placeholder="Milestone title…"
              aria-label="Milestone title"
              className="w-full text-3xl font-bold bg-transparent border-none outline-none"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
            />
          </div>

          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="ms-desc">Description</label>
            <textarea id="ms-desc" value={form.description} onChange={(e) => change({ description: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <DatePrecisionInput label="Date" required date={form.date} precision={form.precision} onChange={({ date, precision }) => change({ date, precision })} />
            <CategoryPicker value={form.categoryId} onChange={(c) => change({ categoryId: c })} />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
              <input type="checkbox" checked={form.hasEnd} onChange={(e) => change({ hasEnd: e.target.checked, endDate: e.target.checked ? form.endDate : null })} />
              It ended on a different date
            </label>
            {form.hasEnd && (
              <div className="max-w-md">
                <DatePrecisionInput label="End date" date={form.endDate} precision={form.endPrecision} onChange={({ date, precision }) => change({ endDate: date, endPrecision: precision })} />
              </div>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => change({ stories: ids })} emptyHint="No stories yet." />
            <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => change({ albums: ids })} emptyHint="No albums yet." />
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        </div>
      </div>
    </form>
  );
}

export function NewMilestonePage() {
  return <MilestoneFormPage milestoneId={null} />;
}

export default function MilestoneEditorPage() {
  const { milestoneId } = useParams({ from: "/timeline/$milestoneId" });
  // Keyed so moving between milestones always starts from a clean form.
  return <MilestoneFormPage key={milestoneId} milestoneId={Number(milestoneId)} />;
}
