import { useEffect, useState } from "react";
import { Plus, Clock, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { listMilestones, createMilestone, updateMilestone, deleteMilestone } from "@/lib/actions/milestones";
import type { Milestone } from "@/lib/models";

interface MilestoneForm {
  title: string;
  description: string;
  date: string;
  date_precision: "year" | "month" | "day";
  category: string;
  color: string;
}

const DEFAULT_FORM: MilestoneForm = {
  title: "",
  description: "",
  date: "",
  date_precision: "day",
  category: "",
  color: "#3D7A8A",
};

export default function TimelinePage() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [form, setForm] = useState<MilestoneForm>(DEFAULT_FORM);

  useEffect(() => {
    listMilestones().then(setMilestones).catch(console.error).finally(() => setLoading(false));
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowModal(true);
  }

  function openEdit(m: Milestone) {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description ?? "",
      date: m.date,
      date_precision: m.date_precision,
      category: m.category ?? "",
      color: m.color,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.date) return;

    if (editing) {
      const updated = await updateMilestone(editing.id, {
        title: form.title,
        description: form.description || undefined,
        date: form.date,
        date_precision: form.date_precision,
        category: form.category || undefined,
        color: form.color,
      });
      setMilestones((prev) => prev.map((m) => (m.id === editing.id ? updated : m)).sort((a, b) => a.date.localeCompare(b.date)));
    } else {
      const created = await createMilestone({
        title: form.title,
        description: form.description || undefined,
        date: form.date,
        date_precision: form.date_precision,
        category: form.category || undefined,
        color: form.color,
      });
      setMilestones((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    }
    setShowModal(false);
  }

  async function handleDelete(m: Milestone) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    await deleteMilestone(m.id);
    setMilestones((prev) => prev.filter((x) => x.id !== m.id));
  }

  function formatDate(date: string, precision: string) {
    if (precision === "year") return date.substring(0, 4);
    if (precision === "month") return date.substring(0, 7);
    return date.substring(0, 10);
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Timeline"
        subtitle="Key moments and milestones in your life"
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
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
            <button
              onClick={openAdd}
              className="px-4 py-2 rounded-lg text-sm text-white"
              style={{ background: "var(--color-primary)" }}
            >
              Add Your First Milestone
            </button>
          }
        />
      ) : (
        <div className="relative pl-8 max-w-2xl">
          <div className="absolute left-3 top-0 bottom-0 w-0.5" style={{ background: "var(--color-border)" }} />
          <div className="space-y-6">
            {milestones.map((m) => (
              <div key={m.id} className="relative group">
                <div
                  className="absolute -left-8 top-3 w-4 h-4 rounded-full border-2 border-white"
                  style={{ background: m.color || "var(--color-primary)" }}
                />
                <div
                  className="p-4 rounded-xl border"
                  style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                        {m.title}
                      </h3>
                      {m.description && (
                        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-secondary)" }}>{m.description}</p>
                      )}
                      {m.category && (
                        <span className="inline-block text-xs mt-1 px-2 py-0.5 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                          {m.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {formatDate(m.date, m.date_precision)}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button onClick={() => openEdit(m)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(m)} className="p-1 rounded" style={{ color: "var(--color-error)" }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Milestone" : "Add Milestone"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Title *</label>
            <input
              type="text"
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
              style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Precision</label>
              <select
                value={form.date_precision}
                onChange={(e) => setForm({ ...form, date_precision: e.target.value as "year" | "month" | "day" })}
                className="px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              >
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Family, Career, Travel"
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--color-text)" }}>Color</label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-9 w-14 rounded-lg border cursor-pointer"
                style={{ borderColor: "var(--color-border)" }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg text-sm text-white font-medium"
              style={{ background: "var(--color-primary)" }}
            >
              {editing ? "Save Changes" : "Add Milestone"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
