import { useEffect, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import CategoryPicker from "@/components/forms/CategoryPicker";
import DatePrecisionInput from "@/components/forms/DatePrecisionInput";
import ImagePicker from "@/components/forms/ImagePicker";
import LinkedPicker from "@/components/forms/LinkedPicker";
import { getCareerEntry, createCareerEntry, updateCareerEntry, deleteCareerEntry } from "@/lib/actions/career";
import { getEntityLinks, listLinkTargets, setEntityLinks, type LinkTarget } from "@/lib/actions/entity-links";

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

/** Add a career entry, or edit one, on its own page. */
function CareerFormPage({ entryId }: { entryId: number | null }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<CareerForm>(EMPTY_FORM);
  const [targets, setTargets] = useState<{ stories: LinkTarget[]; albums: LinkTarget[] }>({ stories: [], albums: [] });
  const [loading, setLoading] = useState(entryId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLinkTargets().then(setTargets).catch(console.error);
    if (entryId === null) return;
    Promise.all([getCareerEntry(entryId), getEntityLinks("career", entryId)])
      .then(([entry, links]) => {
        if (!entry) return setNotFound(true);
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
          stories: links.stories,
          albums: links.albums,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entryId]);

  const change = (patch: Partial<CareerForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setError(null);
  };
  const goBack = () => navigate({ to: "/career" });
  const isEdu = form.entryType === "education";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.organization.trim()) return setError(isEdu ? "Enter the school or institution." : "Enter the company or organization.");
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
      const saved = entryId !== null ? await updateCareerEntry(entryId, data) : await createCareerEntry(data);
      await setEntityLinks("career", saved.id, { stories: form.stories, albums: form.albums });
      setDirty(false);
      goBack();
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (entryId === null || !confirm(`Delete "${form.title ? `${form.title} at ` : ""}${form.organization}"? This cannot be undone.`)) return;
    await deleteCareerEntry(entryId);
    goBack();
  }

  function handleCancel() {
    if (dirty && !confirm("Discard your changes?")) return;
    goBack();
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (notFound) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Career entry not found.</div>;

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const label = "block text-sm font-medium mb-1";

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          Career
        </button>
        <span className="flex-1 text-xs" style={{ color: "var(--color-text-muted)" }} role="status">
          {entryId === null ? "New position" : dirty ? "Unsaved changes" : "No changes"}
        </span>
        <button type="submit" disabled={saving} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {saving ? "Saving…" : entryId === null ? "Add position" : "Save changes"}
        </button>
        {entryId !== null && (
          <button type="button" onClick={() => void handleDelete()} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--color-error)" }} title="Delete" aria-label="Delete position">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <ImagePicker label={isEdu ? "School logo" : "Company logo"} allowGallery value={form.logoPath} onChange={(p) => change({ logoPath: p })} emptyHint="No logo" />

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-type">Type</label>
              <select id="car-type" value={form.entryType} onChange={(e) => change({ entryType: e.target.value as "job" | "education" })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field}>
                <option value="job">Job</option>
                <option value="education">Education</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-org">{isEdu ? "School *" : "Company *"}</label>
              <input id="car-org" autoFocus={entryId === null} value={form.organization} onChange={(e) => change({ organization: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>

          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-title">{isEdu ? "Degree / program" : "Job title"}</label>
            <input
              id="car-title"
              value={form.title}
              onChange={(e) => change({ title: e.target.value })}
              placeholder={isEdu ? "e.g. B.S. Computer Science" : "e.g. Knowledge Architect"}
              className="w-full text-2xl font-bold bg-transparent border-none outline-none px-0"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-emp">Employment type <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
              <select id="car-emp" value={form.employmentType} onChange={(e) => change({ employmentType: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field}>
                <option value="">Select type…</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-loc">Location <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
              <input id="car-loc" value={form.location} onChange={(e) => change({ location: e.target.value })} placeholder="City, State" className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <DatePrecisionInput label="Start" required showDay={false} date={form.startDate} precision={monthPrecision(form.startDate)} onChange={({ date }) => change({ startDate: date })} />
            <div>
              {!form.isCurrent && <DatePrecisionInput label="End" showDay={false} date={form.endDate} precision={monthPrecision(form.endDate)} onChange={({ date }) => change({ endDate: date })} />}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--color-text)" }}>
            <input type="checkbox" checked={form.isCurrent} onChange={(e) => change({ isCurrent: e.target.checked })} />
            {isEdu ? "I currently study here" : "I currently work here"}
          </label>

          <div>
            <label className={label} style={{ color: "var(--color-text)" }} htmlFor="car-desc">Description</label>
            <textarea id="car-desc" value={form.description} onChange={(e) => change({ description: e.target.value })} rows={6} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
          </div>

          <CategoryPicker value={form.categoryId} onChange={(c) => change({ categoryId: c })} />

          <div className="grid gap-5 sm:grid-cols-2">
            <LinkedPicker tone="album" label="Related albums" emoji="🖼️" options={targets.albums} value={form.albums} onChange={(ids) => change({ albums: ids })} emptyHint="No albums yet." />
            <LinkedPicker label="Related stories" emoji="📖" options={targets.stories} value={form.stories} onChange={(ids) => change({ stories: ids })} emptyHint="No stories yet." />
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
        </div>
      </div>
    </form>
  );
}

export function NewCareerPage() {
  return <CareerFormPage entryId={null} />;
}

export default function CareerEditorPage() {
  const { entryId } = useParams({ from: "/career/$entryId" });
  return <CareerFormPage key={entryId} entryId={Number(entryId)} />;
}
