import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Users, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import FamilyTreeChart from "@/components/family/FamilyTreeChart";
import { deleteFamilyMember, describeRelationship, listFamilyMembers, listRelationships } from "@/lib/actions/family-tree";
import { imageSrc } from "@/lib/image-src";
import { formatFamilyName } from "@/lib/reader-utils";
import type { FamilyMember, FamilyRelationship } from "@/lib/models";

type Tab = "tree" | "members";

export default function FamilyTreePage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rels, setRels] = useState<FamilyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("tree");

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

  const openAdd = () => navigate({ to: "/family-tree/new" });
  const openEdit = (m: FamilyMember) => navigate({ to: "/family-tree/$memberId", params: { memberId: String(m.id) } });

  async function handleDelete(m: FamilyMember) {
    const n = relationshipLines(m.id).length;
    const extra = n > 0 ? ` Their ${n} relationship${n === 1 ? "" : "s"} will be removed too.` : "";
    if (!confirm(`Remove ${formatFamilyName(m)}?${extra} This cannot be undone.`)) return;
    await deleteFamilyMember(m.id);
    await reload();
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
                  <div key={m.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("a, button")) openEdit(m); }} className="p-4 cursor-pointer rounded-xl border group" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
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
    </div>
  );
}
