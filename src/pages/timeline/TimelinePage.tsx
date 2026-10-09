import { useCallback, useEffect, useState } from "react";
import { Plus, Clock, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import CategoryPicker from "@/components/forms/CategoryPicker";
import DatePrecisionInput from "@/components/forms/DatePrecisionInput";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { listMilestones, createMilestone, updateMilestone, deleteMilestone } from "@/lib/actions/milestones";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";
import { loadMilestoneLinks, type LinkContext } from "@/lib/actions/related";
import { imageSrc } from "@/lib/image-src";
import { formatShortDate } from "@/lib/reader-utils";
import type { DatePrecision } from "@/lib/date-parts";
import type { Milestone } from "@/lib/models";

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

export default function TimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [form, setForm] = useState<MilestoneForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [m, l] = await Promise.all([listMilestones(), loadMilestoneLinks()]);
    setMilestones(m);
    setLinks(l);
  }, []);

  useEffect(() => {
    Promise.all([reload(), listLinkTargets().then(setTargets)])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reload]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  }

  async function openEdit(m: Milestone) {
    const current = await getEntityLinks("milestone", m.id);
    setEditing(m);
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
      stories: current.stories,
      albums: current.albums,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
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
      const saved = editing ? await updateMilestone(editing.id, data) : await createMilestone(data);
      await setEntityLinks("milestone", saved.id, { stories: form.stories, albums: form.albums });
      await reload();
      setShowModal(false);
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: Milestone) {
    if (!confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    await deleteMilestone(m.id);
    await reload();
  }

  // Group by year, oldest first, like the public timeline.
  const groups: { year: string; items: Milestone[] }[] = [];
  for (const m of milestones) {
    const year = m.date.substring(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(m);
    else groups.push({ year, items: [m] });
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  return (
    <div className="p-8">
      <PageHeader
        title="Timeline"
        subtitle="Key moments and milestones in your life"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} />
            Add Milestone
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={<Clock size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No milestones yet"
          description="Mark the moments that shaped your life — births, moves, achievements, and more."
          action={
            <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Add Your First Milestone
            </button>
          }
        />
      ) : (
        <div className="relative max-w-3xl">
          <div className="absolute bottom-2 left-5 top-2 w-px" style={{ background: "var(--color-border)" }} />
          <div className="space-y-8">
            {groups.map((g) => (
              <div key={g.year}>
                <div className="relative mb-4 flex items-center gap-4">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-md" style={{ background: "var(--color-primary)" }}>
                    {g.year}
                  </div>
                  <span className="text-lg font-semibold" style={{ color: "var(--color-text-muted)" }}>{g.year}</span>
                </div>
                <div className="ml-16 space-y-3">
                  {g.items.map((m) => {
                    const img = imageSrc(m.image_path) ?? imageSrc(links?.thumbnails.get(m.id));
                    return (
                      <div key={m.id} className="group relative overflow-hidden rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                        <div className="absolute top-5 h-3 w-3 rounded-full ring-2 ring-white" style={{ left: "-2.75rem", background: m.category_color || "#6366F1" }} />
                        {img && <img src={img} alt="" className="h-32 w-full object-cover" loading="lazy" />}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <CategoryChip variant="solid" name={m.category} color={m.category_color} icon={m.category_icon} />
                                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                                  {formatShortDate(m.date, m.date_precision)}
                                  {m.end_date && ` – ${formatShortDate(m.end_date, m.end_date_precision ?? "day")}`}
                                </span>
                              </div>
                              <h3 className="font-semibold" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>{m.title}</h3>
                              {m.description && <p className="text-sm mt-1" style={{ color: "var(--color-text-secondary)" }}>{m.description}</p>}
                              <StoryChips items={links?.stories.get(m.id)} />
                              <AlbumChips items={links?.albums.get(m.id)} />
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button onClick={() => void openEdit(m)} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit milestone" aria-label={`Edit ${m.title}`}>
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => void handleDelete(m)} className="p-1.5 rounded" style={{ color: "var(--color-error)" }} title="Delete milestone" aria-label={`Delete ${m.title}`}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Milestone" : "New Milestone"} maxWidth="620px">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="ms-title">Title *</label>
            <input id="ms-title" autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }} htmlFor="ms-desc">Description</label>
            <textarea id="ms-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={field} />
          </div>

          <DatePrecisionInput label="Date" required date={form.date} precision={form.precision} onChange={({ date, precision }) => setForm((f) => ({ ...f, date, precision }))} />

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
            <input type="checkbox" checked={form.hasEnd} onChange={(e) => setForm({ ...form, hasEnd: e.target.checked, endDate: e.target.checked ? form.endDate : null })} />
            It ended on a different date
          </label>
          {form.hasEnd && (
            <DatePrecisionInput label="End date" date={form.endDate} precision={form.endPrecision} onChange={({ date, precision }) => setForm((f) => ({ ...f, endDate: date, endPrecision: precision }))} />
          )}

          <CategoryPicker value={form.categoryId} onChange={(c) => setForm({ ...form, categoryId: c })} />
          <ImagePicker label="Image" allowGallery value={form.imagePath} onChange={(p) => setForm({ ...form, imagePath: p })} emptyHint="No image" />
          <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => setForm({ ...form, stories: ids })} emptyHint="No stories yet." />
          <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => setForm({ ...form, albums: ids })} emptyHint="No albums yet." />

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Milestone"}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
