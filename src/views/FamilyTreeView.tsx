import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import { listFamilyMembers } from "@/lib/actions/family-tree";
import { imageSrc } from "@/lib/image-src";
import type { FamilyMember } from "@/lib/models";

export default function FamilyTreeView() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFamilyMembers().then(setMembers).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  return (
    <ReadPage title="Family Tree" subtitle={`${members.length} ${members.length === 1 ? "family member" : "family members"}`}>
      {members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No family members yet"
          description="Family members will appear here once added."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((m) => {
            const photo = imageSrc(m.photo_path);
            return (
              <div
                key={m.id}
                className="p-4 rounded-xl border"
                style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start gap-3">
                  {photo ? (
                    <img src={photo} alt={m.given_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0"
                      style={{ background: "var(--color-primary)" }}
                    >
                      {m.given_name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ fontFamily: "var(--font-heading)", color: "var(--color-text)" }}>
                      {m.given_name} {m.surname ?? ""}
                    </div>
                    {m.birth_date && (
                      <div className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                        b. {m.birth_date.substring(0, 4)}
                        {m.death_date ? ` — d. ${m.death_date.substring(0, 4)}` : ""}
                      </div>
                    )}
                    {m.birth_place && (
                      <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>{m.birth_place}</div>
                    )}
                  </div>
                </div>
                {m.bio && (
                  <p className="text-xs mt-3" style={{ color: "var(--color-text-secondary)" }}>{m.bio}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ReadPage>
  );
}
