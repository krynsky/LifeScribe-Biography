import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { listFamilyMembers } from "@/lib/actions/family-tree";
import { localFileUrl } from "@/lib/db";
import type { FamilyMember } from "@/lib/models";

export default function ReaderFamilyTreePage() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFamilyMembers().then(setMembers).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
        Family Tree
      </h1>

      {loading ? (
        <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No family members yet"
          description="Family members will appear here once added."
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {members.map((m) => (
            <div key={m.id} className="p-4 rounded-xl border" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}>
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
                  {m.birth_date && (
                    <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                      b. {m.birth_date.substring(0, 4)}{m.death_date ? ` — d. ${m.death_date.substring(0, 4)}` : ""}
                    </div>
                  )}
                  {m.birth_place && <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.birth_place}</div>}
                </div>
              </div>
              {m.bio && <p className="text-xs mt-2" style={{ color: "var(--color-text-secondary)" }}>{m.bio}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
