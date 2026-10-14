import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, Trash2, X } from "lucide-react";
import ImagePicker from "@/components/forms/ImagePicker";
import {
  RELATIONSHIP_PHRASES,
  RELATIONSHIP_TYPES,
  addRelationship,
  createFamilyMember,
  deleteFamilyMember,
  describeRelationship,
  getFamilyMember,
  listFamilyMembers,
  listRelationships,
  removeRelationship,
  setRelationshipEnded,
  updateFamilyMember,
  type RelationshipType,
} from "@/lib/actions/family-tree";
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

/** Add a family member, or edit one (and their relationships), on its own page. */
function MemberFormPage({ memberId, justCreated }: { memberId: number | null; justCreated?: boolean }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rels, setRels] = useState<FamilyRelationship[]>([]);
  const [loading, setLoading] = useState(memberId !== null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(justCreated ? "Saved. Add how this person is related to others below." : null);

  const reloadPeople = useCallback(async () => {
    const [m, r] = await Promise.all([listFamilyMembers(), listRelationships()]);
    setMembers(m);
    setRels(r);
  }, []);

  useEffect(() => {
    reloadPeople().catch(console.error);
    if (memberId === null) return;
    getFamilyMember(memberId)
      .then((m) => {
        if (!m) return setNotFound(true);
        setMember(m);
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
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [memberId, reloadPeople]);

  const change = (patch: Partial<MemberForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setError(null);
    setNotice(null);
  };
  const goBack = () => navigate({ to: "/family-tree" });

  async function handleSave(e: React.FormEvent) {
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
      setDirty(false);
      if (memberId !== null) {
        await updateFamilyMember(memberId, data);
        goBack();
      } else {
        // Land on the edit page so relationships can be added straight away.
        const created = await createFamilyMember(data);
        await navigate({ to: "/family-tree/$memberId", params: { memberId: String(created.id) }, search: { created: "1" }, replace: true });
      }
    } catch (err) {
      setError(`Could not save: ${String(err)}`);
      setSaving(false);
    }
  }

  function relationshipLines(id: number) {
    const byId = new Map(members.map((m) => [m.id, m]));
    return rels
      .map((r) => ({ rel: r, d: describeRelationship(r, id) }))
      .filter((x): x is { rel: FamilyRelationship; d: NonNullable<ReturnType<typeof describeRelationship>> } => !!x.d && byId.has(x.d.otherId));
  }

  async function handleDelete() {
    if (!member) return;
    const n = relationshipLines(member.id).length;
    const extra = n > 0 ? ` Their ${n} relationship${n === 1 ? "" : "s"} will be removed too.` : "";
    if (!confirm(`Remove ${formatFamilyName(member)}?${extra} This cannot be undone.`)) return;
    await deleteFamilyMember(member.id);
    goBack();
  }

  function handleCancel() {
    if (dirty && !confirm("Discard your changes?")) return;
    goBack();
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>;
  if (notFound) return <div className="p-8 text-sm" style={{ color: "var(--color-error)" }}>Family member not found.</div>;

  const field = { background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" };
  const labelCls = "block text-xs font-medium mb-1";

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
        <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 text-sm flex-shrink-0" style={{ color: "var(--color-text-secondary)" }}>
          <ArrowLeft size={14} />
          Family Tree
        </button>
        <span className="flex-1 text-xs" style={{ color: notice ? "var(--color-success)" : "var(--color-text-muted)" }} role="status">
          {notice ?? (memberId === null ? "New family member" : dirty ? "Unsaved changes" : "No changes")}
        </span>
        <button type="submit" disabled={saving} className="text-xs px-4 py-1.5 rounded-lg font-medium text-white disabled:opacity-60" style={{ background: "var(--color-primary)" }}>
          {saving ? "Saving…" : memberId === null ? "Add member" : "Save changes"}
        </button>
        {member && (
          <button type="button" onClick={() => void handleDelete()} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: "var(--color-error)" }} title="Delete" aria-label="Delete family member">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-5">
          <ImagePicker label="Photo" shape="circle" value={form.photo_path} onChange={(p) => change({ photo_path: p })} emptyHint="No photo" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-given">First name *</label>
              <input id="fm-given" autoFocus={memberId === null} value={form.given_name} onChange={(e) => change({ given_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-sur">Last name</label>
              <input id="fm-sur" value={form.surname} onChange={(e) => change({ surname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-birthsur">Birth surname <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(maiden name, optional)</span></label>
              <input id="fm-birthsur" value={form.birth_surname} onChange={(e) => change({ birth_surname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-nick">Nickname <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(optional)</span></label>
              <input id="fm-nick" value={form.nickname} onChange={(e) => change({ nickname: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-suffix">Suffix <span className="font-normal" style={{ color: "var(--color-text-muted)" }}>(Jr., III…)</span></label>
              <input id="fm-suffix" value={form.suffix} onChange={(e) => change({ suffix: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <fieldset>
              <legend className={labelCls} style={{ color: "var(--color-text)" }}>Gender</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5">
                {GENDERS.map((g) => (
                  <label key={g.value} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-text)" }}>
                    <input type="radio" name="fm-gender" checked={form.gender === g.value} onChange={() => change({ gender: g.value })} />
                    {g.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-birth">Birth date</label>
              <input id="fm-birth" type="date" value={form.birth_date} onChange={(e) => change({ birth_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-death">Death date</label>
              <input id="fm-death" type="date" value={form.death_date} onChange={(e) => change({ death_date: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-place">Birth place</label>
            <input id="fm-place" value={form.birth_place} onChange={(e) => change({ birth_place: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={field} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--color-text)" }} htmlFor="fm-bio">Bio / notes</label>
            <textarea id="fm-bio" value={form.bio} onChange={(e) => change({ bio: e.target.value })} rows={6} className="w-full px-3 py-2 rounded-lg border text-sm resize-y" style={field} />
          </div>

          {error && <p className="text-sm" style={{ color: "var(--color-error)" }} role="alert">{error}</p>}

          {member ? (
            <RelationshipsEditor member={member} members={members} lines={relationshipLines(member.id)} onChanged={reloadPeople} />
          ) : (
            <p className="text-xs pt-2" style={{ color: "var(--color-text-muted)" }}>After you add this person you can connect them to parents, children, a spouse and siblings.</p>
          )}
        </div>
      </div>
    </form>
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

  async function toggleEnded(id: number, ended: boolean) {
    setBusy(true);
    try {
      await setRelationshipEnded(id, ended);
      await onChanged();
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
                <span className="flex items-center gap-2 flex-shrink-0">
                  {d.type === "spouse" && (
                    <button
                      type="button"
                      onClick={() => void toggleEnded(rel.id, !rel.ended)}
                      disabled={busy}
                      className="px-2 py-0.5 rounded border text-xs"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
                    >
                      {rel.ended ? "Mark as married" : "Mark as divorced"}
                    </button>
                  )}
                  <button type="button" onClick={() => void remove(rel.id)} disabled={busy} aria-label={`Remove relationship with ${formatFamilyName(other)}`} className="p-1 rounded" style={{ color: "var(--color-error)" }}>
                    <X size={13} />
                  </button>
                </span>
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

export function NewMemberPage() {
  return <MemberFormPage memberId={null} />;
}

export default function MemberEditorPage() {
  const { memberId } = useParams({ from: "/family-tree/$memberId" });
  const search = useSearch({ from: "/family-tree/$memberId" });
  return <MemberFormPage key={memberId} memberId={Number(memberId)} justCreated={search.created === "1"} />;
}
