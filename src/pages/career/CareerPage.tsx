import { useCallback, useEffect, useState } from "react";
import { Plus, Briefcase, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import CategoryChip from "@/components/reader/CategoryChip";
import { StoryChips, AlbumChips } from "@/components/reader/LinkedChips";
import CategoryPicker from "@/components/forms/CategoryPicker";
import DatePrecisionInput from "@/components/forms/DatePrecisionInput";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { listCareerEntries, createCareerEntry, updateCareerEntry, deleteCareerEntry } from "@/lib/actions/career";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";
import { loadCareerLinks, type LinkContext } from "@/lib/actions/related";
import { imageSrc } from "@/lib/image-src";
import { computeDuration, formatMonthYear } from "@/lib/reader-utils";
import type { CareerEntry } from "@/lib/models";

// Same choices as the web editor.
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Self-employed", "Freelance", "Contract", "Internship"] as const;

interface CareerForm {
  entryType: "job" | "education";
  title: string;
  organization: string;
  employmentType: string;
  location: string;
  startDate: string | null;
  isCurrent: boolean;
  endDate: string | null;
  description: string;
  logoPath: string | null;
  categoryId: number | null;
  stories: number[];
  albums: number[];
}

const EMPTY_FORM: CareerForm = {
  entryType: "job",
  title: "",
  organization: "",
  employmentType: "",
  location: "",
  startDate: null,
  isCurrent: false,
  endDate: null,
  description: "",
  logoPath: null,
  categoryId: null,
  stories: [],
  albums: [],
};

/** Like the web: January means "year only" (the default when no month was entered), so show the month blank. */
const monthPrecision = (d: string | null) => (d && d.substring(5, 7) === "01" ? "year" : "month");

export default function CareerPage() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [links, setLinks] = useState<LinkContext | null>(null);
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CareerEntry | null>(null);
  const [form, setForm] = useState<CareerForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [e, l] = await Promise.all([listCareerEntries(), loadCareerLinks()]);
    setEntries(e);
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

  async function openEdit(entry: CareerEntry) {
    const current = await getEntityLinks("career", entry.id);
    setEditing(entry);
    setForm({
      entryType: entry.entry_type,
      title: entry.title ?? "",
      organization: entry.organization,
      employmentType: entry.employment_type ?? "",
      location: entry.location ?? "",
      startDate: entry.start_date,
      isCurrent: !!entry.is_current,
      endDate: entry.end_date,
      description: entry.description ?? "",
      logoPath: entry.logo_path,
      categoryId: entry.category_id ?? null,
      stories: current.stories,
      albums: current.albums,
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organization.trim()) return setError(form.entryType === "education" ? "Enter the school or institution." : "Enter the company or organization.");
    if (!form.startDate) return setError("Enter the year you started (and optionally the month).");
    if (!form.isCurrent && form.endDate && form.endDate < form.startDate) return setError("The end date can't be before the start date.");

    setSaving(true);
    setError(null);
    try {
      const data = {
        entry_type: form.entryType,
        organization: form.organization.trim(),
        title: form.title.trim() || null,
        employment_type: form.employmentType || null,
        location: form.location.trim() || null,
        start_date: form.startDate,
        is_current: form.isCurrent,
        end_date: form.isCurrent ? null : form.endDate,
        description: form.description.trim() || null,
        logo_path: form.logoPath,
        category_id: form.categoryId,
      };
      const saved = editing ? await updateCareerEntry(editing.id, data) : await createCareerEntry(data);
      await setEntityLinks("career", saved.id, { stories: form.stories, albums: form.albums });
      await reload();
      setShowModal(false);
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: CareerEntry) {
    if (!confirm(`Delete "${entry.title ? `${entry.title} at ` : ""}${entry.organization}"? This cannot be undone.`)) return;
    await deleteCareerEntry(entry.id);
    await reload();
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const label = "block text-sm font-medium mb-1";
  const isEdu = form.entryType === "education";

  return (
    <div className="p-8">
      <PageHeader
        title="Career"
        subtitle="Your work history and education"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} />
            Add Position
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Add your jobs and education to build your professional story."
          action={
            <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>
              Add Your First Position
            </button>
          }
        />
      ) : (
        <div className="space-y-3 max-w-3xl">
          {entries.map((entry) => {
            const logo = imageSrc(entry.logo_path) ?? imageSrc(links?.thumbnails.get(entry.id));
            const range = `${formatMonthYear(entry.start_date)} – ${entry.is_current ? "Present" : entry.end_date ? formatMonthYear(entry.end_date) : "?"}`;
            const duration = computeDuration(entry.start_date, entry.end_date, !!entry.is_current);
            return (
              <div key={entry.id} className="group flex gap-4 p-4 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden text-lg font-bold" style={{ background: "var(--color-surface-2)", color: "var(--color-primary)" }}>
                  {logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : entry.organization.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>
                      {entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}
                    </h3>
                    {!!entry.is_current && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0fdf4", color: "#15803d" }}>Current</span>
                    )}
                    <CategoryChip variant="solid" name={entry.category} color={entry.category_color} icon={entry.category_icon} />
                  </div>
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>
                    {entry.organization}
                    {entry.employment_type && <span style={{ color: "var(--color-text-muted)" }}> · {entry.employment_type}</span>}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {range}
                    {duration && ` · ${duration}`}
                    {entry.location && ` · 📍 ${entry.location}`}
                  </p>
                  {entry.description && <p className="text-sm mt-2 whitespace-pre-line line-clamp-3" style={{ color: "var(--color-text-secondary)" }}>{entry.description}</p>}
                  <AlbumChips items={links?.albums.get(entry.id)} />
                  <StoryChips items={links?.stories.get(entry.id)} />
                </div>
                <div className="flex items-start gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => void openEdit(entry)} className="p-1.5 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${entry.organization}`}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => void handleDelete(entry)} className="p-1.5 rounded" style={{ color: "var(--color-error)" }} title="Delete" aria-label={`Delete ${entry.organization}`}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Position" : "Add Position"} maxWidth="620px">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-type">Type</label>
            <select id="car-type" value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value as "job" | "education" })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field}>
              <option value="job">Job</option>
              <option value="education">Education</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-title">{isEdu ? "Degree / program" : "Job title"}</label>
              <input id="car-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-org">{isEdu ? "School *" : "Company *"}</label>
              <input id="car-org" autoFocus value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-emp">Employment type <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
              <select id="car-emp" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field}>
                <option value="">Select type…</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-loc">Location <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
              <input id="car-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, State" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>

          <DatePrecisionInput label="Start" required showDay={false} date={form.startDate} precision={monthPrecision(form.startDate)} onChange={({ date }) => setForm((f) => ({ ...f, startDate: date }))} />
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
            <input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} />
            {isEdu ? "I currently study here" : "I currently work here"}
          </label>
          {!form.isCurrent && <DatePrecisionInput label="End" showDay={false} date={form.endDate} precision={monthPrecision(form.endDate)} onChange={({ date }) => setForm((f) => ({ ...f, endDate: date }))} />}

          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-desc">Description</label>
            <textarea id="car-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
          </div>

          <ImagePicker label={isEdu ? "School logo" : "Company logo"} allowGallery value={form.logoPath} onChange={(p) => setForm({ ...form, logoPath: p })} emptyHint="No logo" />
          <CategoryPicker value={form.categoryId} onChange={(c) => setForm({ ...form, categoryId: c })} />
          <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => setForm({ ...form, albums: ids })} emptyHint="No albums yet." />
          <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => setForm({ ...form, stories: ids })} emptyHint="No stories yet." />

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Position"}
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
