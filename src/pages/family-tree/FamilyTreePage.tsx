import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Users, Pencil, Trash2, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import ImagePicker from "@/components/forms/ImagePicker";
import FamilyTreeChart from "@/components/family/FamilyTreeChart";
import {
  RELATIONSHIP_PHRASES,
  RELATIONSHIP_TYPES,
  addRelationship,
  createFamilyMember,
  deleteFamilyMember,
  describeRelationship,
  listFamilyMembers,
  listRelationships,
  removeRelationship,
  updateFamilyMember,
  type RelationshipType,
} from "@/lib/actions/family-tree";
import { imageSrc } from "@/lib/image-src";
import { formatFamilyName } from "@/lib/reader-utils";
import type { FamilyMember, FamilyRelationship } from "@/lib/models";

type Gender = "male" | "female" | "other";

interface MemberForm {
  given_name: string;
  surname: string;
  birth_surname: string;
  nickname: string;
  suffix: string;
  gender: Gender;
  birth_date: string;
  death_date: string;
  birth_place: string;
  bio: string;
  photo_path: string | null;
}

const EMPTY_FORM: MemberForm = {
  given_name: "",
  surname: "",
  birth_surname: "",
  nickname: "",
  suffix: "",
  gender: "male",
  birth_date: "",
  death_date: "",
  birth_place: "",
  bio: "",
  photo_path: null,
};

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other / Unknown" },
];

const asGender = (g: string | null | undefined): Gender => (g === "female" || g === "other" ? g : "male");
const dateOnly = (d: string | null) => (d ? d.substring(0, 10) : "");

type Tab = "tree" | "members";

export default function FamilyTreePage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rels, setRels] = useState<FamilyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("tree");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<FamilyMember | null>(null);
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [m, r] = await Promise.all([listFamilyMembers(), listRelationships()]);
    setMembers(m);
    setRels(r);
  }, []);

  useEffect(() => {
    reload().catch(console.error).finally(() => setLoading(false));
  }, [reload]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  /** "is a parent of Jane Doe" lines for one member. */
  function relationshipLines(memberId: number) {
    return rels
      .map((r) => ({ rel: r, d: describeRelationship(r, memberId) }))
      .filter((x): x is { rel: FamilyRelationship; d: NonNullable<ReturnType<typeof describeRelationship>> } => !!x.d && byId.has(x.d.otherId));
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setNotice(null);
    setShowModal(true);
  }

  function openEdit(m: FamilyMember) {
    setEditing(m);
    setForm({
      given_name: m.given_name,
      surname: m.surname ?? "",
      birth_surname: m.birth_surname ?? "",
      nickname: m.nickname ?? "",
      suffix: m.suffix ?? "",
      gender: asGender(m.gender),
      birth_date: dateOnly(m.birth_date),
      death_date: dateOnly(m.death_date),
      birth_place: m.birth_place ?? "",
      bio: m.bio ?? "",
      photo_path: m.photo_path,
    });
    setError(null);
    setNotice(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.given_name.trim()) return setError("Enter a first name.");
    if (form.birth_date && form.death_date && form.death_date < form.birth_date) return setError("The death date can't be before the birth date.");

    setSaving(true);
    setError(null);
    try {
      const data = {
        given_name: form.given_name.trim(),
        surname: form.surname.trim() || null,
        birth_surname: form.birth_surname.trim() || null,
        nickname: form.nickname.trim() || null,
        suffix: form.suffix.trim() || null,
        gender: form.gender,
        birth_date: form.birth_date || null,
        death_date: form.death_date || null,
        birth_place: form.birth_place.trim() || null,
        bio: form.bio.trim() || null,
        photo_path: form.photo_path,
      };
      if (editing) {
        await updateFamilyMember(editing.id, data);
        await reload();
        setShowModal(false);
      } else {
        const created = await createFamilyMember(data);
        await reload();
        // Stay open so relationships can be added straight away.
        setEditing(created);
        setNotice("Saved. Add how this person is related to others below, or close this window.");
      }
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: FamilyMember) {
    const n = relationshipLines(m.id).length;
    const extra = n > 0 ? ` Their ${n} relationship${n === 1 ? "" : "s"} will be removed too.` : "";
    if (!confirm(`Remove ${formatFamilyName(m)}?${extra} This cannot be undone.`)) return;
    await deleteFamilyMember(m.id);
    await reload();
  }

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const labelCls = "block text-xs font-medium mb-1";

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
          description="Start by adding yourself, then add parents, siblings, children and a spouse to build your tree."
          action={<button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm text-white" style={{ background: "var(--color-primary)" }}>Add Yourself First</button>}
        />
      ) : (
        <>
          <div className="flex gap-1 mb-5" role="tablist" aria-label="Family tree view">
            {([["tree", "🌳 Tree"], ["members", "👥 Members"]] as const).map(([value, text]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className="px-4 py-1.5 rounded-lg text-sm border"
                style={{
                  borderColor: tab === value ? "var(--color-primary)" : "var(--color-border)",
                  background: tab === value ? "var(--color-primary)" : "transparent",
                  color: tab === value ? "white" : "var(--color-text-secondary)",
                }}
              >
                {text}
              </button>
            ))}
          </div>

          {tab === "tree" ? (
            <FamilyTreeChart members={members} rels={rels} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((m) => {
                const photo = imageSrc(m.photo_path);
                const lines = relationshipLines(m.id);
                return (
                  <div key={m.id} className="p-4 rounded-xl border group" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
                    <div className="flex items-start gap-3">
                      {photo ? (
                        <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0" style={{ background: "var(--color-primary)" }}>
                          {m.given_name[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>{formatFamilyName(m)}</div>
                        {m.nickname && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>“{m.nickname}”</div>}
                        {m.birth_date && (
                          <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                            b. {m.birth_date.substring(0, 4)}
                            {m.death_date ? ` — d. ${m.death_date.substring(0, 4)}` : ""}
                          </div>
                        )}
                        {m.birth_place && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.birth_place}</div>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(m)} className="p-1 rounded" style={{ color: "var(--color-text-muted)" }} title="Edit" aria-label={`Edit ${m.given_name}`}><Pencil size={12} /></button>
                        <button onClick={() => void handleDelete(m)} className="p-1 rounded" style={{ color: "var(--color-error)" }} title="Delete" aria-label={`Delete ${m.given_name}`}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    {lines.length > 0 && (
                      <ul className="mt-3 space-y-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {lines.map(({ rel, d }) => (
                          <li key={rel.id}>
                            {d.phrase} <span className="font-medium" style={{ color: "var(--color-text)" }}>{formatFamilyName(byId.get(d.otherId)!)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.bio && <p className="text-xs mt-2 line-clamp-2" style={{ color: "var(--color-text-secondary)" }}>{m.bio}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? "Edit Family Member" : "Add Family Member"} maxWidth="640px">
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          <form onSubmit={handleSubmit} className="space-y-3">
            <ImagePicker label="Photo" shape="circle" value={form.photo_path} onChange={(p) => setForm({ ...form, photo_path: p })} emptyHint="No photo" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-given">First name *</label>
                <input id="fm-given" autoFocus value={form.given_name} onChange={(e) => setForm({ ...form, given_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-sur">Last name</label>
                <input id="fm-sur" value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-birthsur">Birth surname <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(maiden name, optional)</span></label>
                <input id="fm-birthsur" value={form.birth_surname} onChange={(e) => setForm({ ...form, birth_surname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-nick">Nickname <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
                <input id="fm-nick" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-suffix">Suffix <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(Jr., III…)</span></label>
                <input id="fm-suffix" value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <fieldset>
                <legend className={labelCls} style={{ color: "var(--color-text)" }}>Gender</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5">
                  {GENDERS.map((g) => (
                    <label key={g.value} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text)" }}>
                      <input type="radio" name="fm-gender" checked={form.gender === g.value} onChange={() => setForm({ ...form, gender: g.value })} />
                      {g.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-birth">Birth date</label>
                <input id="fm-birth" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-death">Death date</label>
                <input id="fm-death" type="date" value={form.death_date} onChange={(e) => setForm({ ...form, death_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
              </div>
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-place">Birth place</label>
              <input id="fm-place" value={form.birth_place} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-bio">Bio / notes</label>
              <textarea id="fm-bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none" style={field} />
            </div>

            {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
            {notice && <p className="text-sm" style={{ color: "var(--color-success)" }} role="status">{notice}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Member"}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                {editing ? "Close" : "Cancel"}
              </button>
            </div>
          </form>

          {editing && (
            <RelationshipsEditor
              member={editing}
              members={members}
              lines={relationshipLines(editing.id)}
              onChanged={reload}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}

interface RelationshipsEditorProps {
  member: FamilyMember;
  members: FamilyMember[];
  lines: { rel: FamilyRelationship; d: { otherId: number; type: RelationshipType; phrase: string } }[];
  onChanged: () => Promise<void>;
}

/** Add and remove how this person is related to everyone else. */
function RelationshipsEditor({ member, members, lines, onChanged }: RelationshipsEditorProps) {
  const others = members.filter((m) => m.id !== member.id);
  const [type, setType] = useState<RelationshipType>("parent");
  const [otherId, setOtherId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };

  async function add() {
    if (otherId === "") return;
    setBusy(true);
    setError(null);
    try {
      await addRelationship(member.id, otherId, type);
      setOtherId("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await removeRelationship(id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>Relationships</h3>
      {lines.length === 0 ? (
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>
          {others.length === 0 ? "Add another family member first, then connect them here." : "No relationships yet."}
        </p>
      ) : (
        <ul className="space-y-1 mb-3">
          {lines.map(({ rel, d }) => {
            const other = members.find((m) => m.id === d.otherId)!;
            return (
              <li key={rel.id} className="flex items-center justify-between gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                <span>
                  {formatFamilyName(member)} {d.phrase} <strong style={{ color: "var(--color-text)" }}>{formatFamilyName(other)}</strong>
                </span>
                <button type="button" onClick={() => void remove(rel.id)} disabled={busy} aria-label={`Remove relationship with ${formatFamilyName(other)}`} className="p-1 rounded" style={{ color: "var(--color-error)" }}>
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>{member.given_name}</span>
          <select value={type} onChange={(e) => setType(e.target.value as RelationshipType)} aria-label="Relationship" className="px-2 py-1.5 rounded-lg border text-sm" style={field}>
            {RELATIONSHIP_TYPES.map((t) => (
              <option key={t} value={t}>{RELATIONSHIP_PHRASES[t]}</option>
            ))}
          </select>
          <select value={otherId} onChange={(e) => setOtherId(e.target.value ? Number(e.target.value) : "")} aria-label="Person" className="flex-1 min-w-[10rem] px-2 py-1.5 rounded-lg border text-sm" style={field}>
            <option value="">Choose a person…</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>{formatFamilyName(m)}</option>
            ))}
          </select>
          <button type="button" onClick={() => void add()} disabled={busy || otherId === ""} className="px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50" style={{ background: "var(--color-primary)" }}>
            Add
          </button>
        </div>
      )}
      {error && <p className="text-xs mt-2" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}
    </section>
  );
}
