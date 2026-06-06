import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { listFamilyMembers } from "@/lib/actions/family-tree";
import type { FamilyMember } from "@/lib/models";

export default function FamilyTreePage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFamilyMembers().then(setMembers).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title="Family Tree"
        subtitle="The people who shaped your story"
        actions={
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium"
            style={{ background: "var(--color-primary)" }}
          >
            <Plus size={14} />
            Add Family Member
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
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {members.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-xl border"
              style={{
                background: "var(--color-surface)",
                borderColor: "var(--color-border)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ background: "var(--color-primary)" }}
                >
                  {member.given_name[0]}
                </div>
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--color-text)" }}>
                    {member.given_name} {member.surname ?? ""}
                  </div>
                  {member.birth_date && (
                    <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                      b. {member.birth_date.substring(0, 4)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
