import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import ReadPage, { ReadLoading } from "@/components/reader/ReadPage";
import FamilyTreeChart from "@/components/family/FamilyTreeChart";
import { listFamilyMembers, listRelationships } from "@/lib/actions/family-tree";
import type { FamilyMember, FamilyRelationship } from "@/lib/models";

export default function FamilyTreeView() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [rels, setRels] = useState<FamilyRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listFamilyMembers(), listRelationships()])
      .then(([m, r]) => {
        setMembers(m);
        setRels(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ReadLoading />;

  const subtitle = `${members.length} ${members.length === 1 ? "family member" : "family members"}`;

  return (
    <ReadPage title="Family Tree" subtitle={subtitle} width="full">
      {members.length === 0 ? (
        <EmptyState
          icon={<Users size={24} style={{ color: "var(--color-text-muted)" }} />}
          title="No family members yet"
          description="Family members will appear here once added."
        />
      ) : (
        <FamilyTreeChart members={members} rels={rels} />
      )}
    </ReadPage>
  );
}
