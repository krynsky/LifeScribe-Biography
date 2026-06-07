import { useEffect, useState } from "react";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import { listFamilyMembers, createFamilyMember, updateFamilyMember, deleteFamilyMember } from "@/lib/actions/family-tree";
import { localFileUrl } from "@/lib/db";
import type { FamilyMember } from "@/lib/models";

interface MemberForm {
  given_name: string;
  surname: string;
  birth_date: string;
  death_date: string;
  birth_place: string;
  bio: string;
}

const DEFAULT_FORM: MemberForm = { given_name: "", surname: "", birth_date: "", death_date: "", birth_place: "", bio: "" };

export default function FamilyTreePage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [form, setForm] = useState<MemberForm>(DEFAULT_FORM);

  useEffect(() => {
    listFamilyMembers().then(setMembers).catch(console.error).finally(() => setLoading(false));
  }, []);

  function openAdd() { setEditing(null); setForm(DEFAULT_FORM); setShowModal(true); }
  function openEdit(m: FamilyMember) {
    setEditing(m);
    setForm({ given_name: m.given_name, surname: m.surname ?? "", birth_date: m.birth_date ?? "", death_date: m.death_date ?? "", birth_place: m.birth_place ?? "", bio: m.bio ?? "" });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.given_name) return;
    if (editing) {
      const updated = await updateFamilyMember(editing.id, { given_name: form.given_name, surname: form.surname || undefined, birth_date: form.birth_date || null, death_date: form.death_date || null, birth_place: form.birth_place || null, bio: form.bio || null });
      setMembers((prev) => prev.map((m) => m.id === editing.id ? updated : m));
    } else {
      const created = await createFamilyMember({ given_name: form.given_name, surname: form.surname || undefined, birth_date: form.birth_date || undefined, death_date: form.death_date || undefined, birth_place: form.birth_place || undefined, bio: form.bio || undefined });
      setMembers((prev) => [...prev, created]);
    }
    setShowModal(false);
  }

  async function handleDelete(m: FamilyMember) {
    if (!confirm(`Remove ${m.given_name} ${m.surname ?? ""}?`)) return;
    await deleteFamilyMember(m.id);
    setMembers((prev) => prev.filter((x) => x.id !== m.id));
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Family Tree"
        subtitle="The people who shaped your story"
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
            <Plus size={14} /> Add Family Member
          </button>
        }
      />

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No family members yet"
          description="Add parents, siblings, children, and spouses to build your family tree."
          action={<button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>Add Family Member</button>}
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="p-4 rounded-xl border group" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
              <div className="flex items-start gap-3">
                {m.photo_path ? (
                  <img src={localFileUrl(m.photo_path)} alt={m.given_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0" style={{ background: "var(--color-primary)" }}>
                    {m.given_name[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
                    {m.given_name} {m.surname ?? ""}
                  </div>
                  {m.birth_date && <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>b. {m.birth_date.substring(0, 4)}{m.death_date ? ` — d. ${m.death_date.substring(0, 4)}` : ""}</div>}
                  {m.birth_place && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.birth_place}</div>}
                </div>
                <div className="hidden group-hover:flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }}><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(m)} className="p-1 rounded" style={{ color: "var(--color-error)" }}><Trash2 size={12} /></button>
                </div>
              </div>
              {m.bio && <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{m.bio}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Family Member" : "Add Family Member"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>First Name *</label>
              <input type="text" autoFocus value={form.given_name} onChange={(e) => setForm({ ...form, given_name: e.target.value })} required className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Last Name</label>
              <input type="text" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Birth Date</label>
              <input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Death Date</label>
              <input type="date" value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Birth Place</label>
            <input type="text" value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text)" }}>Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="flex-1 py-2 rounded-lg text-sm text-white font-medium" style={{ background: "var(--color-primary)" }}>
              {editing ? "Save" : "Add Member"}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
