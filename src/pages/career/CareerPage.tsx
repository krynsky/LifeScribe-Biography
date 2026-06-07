import { useEffect, useState } from "react";
import { Plus, Briefcase, GraduationCap, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { listCareerEntries, createCareerEntry, updateCareerEntry, deleteCareerEntry } from "@/lib/actions/career";
import type { CareerEntry } from "@/lib/models";

interface CareerForm {
  entry_type: "job" | "education";
  organization: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  location: string;
}

const DEFAULT_FORM: CareerForm = { entry_type: "job", organization: "", title: "", description: "", start_date: "", end_date: "", is_current: false, location: "" };

export default function CareerPage() {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CareerEntry | null>(null);
  const [form, setForm] = useState<CareerForm>(DEFAULT_FORM);

  useEffect(() => {
    listCareerEntries().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setForm(DEFAULT_FORM); setShowModal(true); }
  function openEdit(e: CareerEntry) {
    setEditing(e);
    setForm({ entry_type: e.entry_type, organization: e.organization, title: e.title ?? "", description: e.description ?? "", start_date: e.start_date ?? "", end_date: e.end_date ?? "", is_current: e.is_current, location: e.location ?? "" });
    setShowModal(true);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.organization) return;
    if (editing) {
      const updated = await updateCareerEntry(editing.id, { ...form, title: form.title || undefined, description: form.description || undefined, start_date: form.start_date || undefined, end_date: form.end_date || undefined, location: form.location || undefined });
      setEntries((prev) => prev.map((e) => e.id === editing.id ? updated : e));
    } else {
      const created = await createCareerEntry({ ...form, title: form.title || undefined, description: form.description || undefined, start_date: form.start_date || undefined, end_date: form.end_date || undefined, location: form.location || undefined });
      setEntries((prev) => [created, ...prev]);
    }
    setShowModal(false);
  }

  async function handleDelete(entry: CareerEntry) {
    if (!confirm(`Delete "${entry.organization}"?`)) return;
    await deleteCareerEntry(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Career & Education"
        subtitle="Your professional journey and academic milestones"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} /> Add Entry
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No career entries yet"
          description="Add your work history and education to preserve your professional story."
          action={<button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>Add First Entry</button>}
        />
      ) : (
        <div className="space-y-3 max-w-2xl">
          {entries.map((entry) => {
            const Icon = entry.entry_type === "education" ? GraduationCap : Briefcase;
            return (
              <div key={entry.id} className="p-5 rounded-xl border flex items-start gap-4 group" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--color-surface-2)" }}>
                  <Icon size={16} style={{ color: "var(--color-text-muted)" }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{entry.title || (entry.entry_type === "education" ? "Student" : "Employee")}</div>
                      <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{entry.organization}</div>
                      {entry.location && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{entry.location}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {entry.start_date?.substring(0, 7)}{entry.is_current ? " – Present" : entry.end_date ? ` – ${entry.end_date.substring(0, 7)}` : ""}
                      </div>
                      <div className="hidden group-hover:flex gap-1">
                        <button onClick={() => openEdit(entry)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }}><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(entry)} className="p-1 rounded" style={{ color: "var(--color-error)" }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                  {entry.description && <p className="text-sm mt-1.5" style={{ color: "var(--color-text-secondary)" }}>{entry.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Entry" : "Add Career / Education"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Type</label>
            <div className="flex gap-3">
              {(["job", "education"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, entry_type: t })}
                  className="flex-1 py-2 rounded-lg border text-sm font-medium transition-colors"
                  style={{ background: form.entry_type === t ? "var(--color-primary)" : "var(--color-surface)", color: form.entry_type === t ? "white" : "var(--color-text)", borderColor: form.entry_type === t ? "var(--color-primary)" : "var(--color-border)" }}>
                  {t === "job" ? "Job" : "Education"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>{form.entry_type === "education" ? "School / Institution *" : "Company *"}</label>
            <input type="text" autoFocus value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} required className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>{form.entry_type === "education" ? "Degree / Field" : "Job Title"}</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Start</label>
              <input type="month" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>End</label>
              <input type="month" value={form.end_date} disabled={form.is_current} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm disabled:opacity-40" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--color-text)" }}>
            <input type="checkbox" checked={form.is_current} onChange={(e) => setForm({ ...form, is_current: e.target.checked, end_date: e.target.checked ? "" : form.end_date })} />
            Currently here
          </label>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Location</label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>{editing ? "Save" : "Add Entry"}</button>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
