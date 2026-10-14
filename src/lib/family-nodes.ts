import type { Node as FTNode } from "relatives-tree/lib/types";
import type { FamilyMember, FamilyRelationship } from "@/lib/models";

/**
 * Build relatives-tree nodes from members + relationships, the same way the web
 * bio does: collect parents/children/siblings/spouses, then infer a second
 * parent from a single parent's spouse so couples render together.
 */
export function buildNodes(members: FamilyMember[], rels: FamilyRelationship[]): readonly FTNode[] {
  // relatives-tree uses const enums; the runtime values are plain strings.
  type G = FTNode["gender"];
  type R = FTNode["parents"][number]["type"];
  const blood = "blood" as unknown as R;
  const married = "married" as unknown as R;
  const divorced = "divorced" as unknown as R;

  const parentMap = new Map<number, Set<number>>();
  const childMap = new Map<number, Set<number>>();
  const siblingMap = new Map<number, Set<number>>();
  // spouse -> whether that marriage has ended
  const spouseMap = new Map<number, Map<number, boolean>>();
  const ensure = (map: Map<number, Set<number>>, id: number) => {
    let s = map.get(id);
    if (!s) map.set(id, (s = new Set()));
    return s;
  };
  const ensureSpouses = (id: number) => {
    let s = spouseMap.get(id);
    if (!s) spouseMap.set(id, (s = new Map()));
    return s;
  };

  for (const m of members) {
    ensure(parentMap, m.id);
    ensure(childMap, m.id);
    ensure(siblingMap, m.id);
    ensureSpouses(m.id);
  }

  const known = new Set(members.map((m) => m.id));
  for (const r of rels) {
    const a = r.from_member_id;
    const b = r.to_member_id;
    if (!known.has(a) || !known.has(b)) continue;
    switch (r.relationship_type) {
      case "parent": // a is a parent of b
        ensure(childMap, a).add(b);
        ensure(parentMap, b).add(a);
        break;
      case "child": // a is a child of b
        ensure(parentMap, a).add(b);
        ensure(childMap, b).add(a);
        break;
      case "sibling":
        ensure(siblingMap, a).add(b);
        ensure(siblingMap, b).add(a);
        break;
      case "spouse":
        ensureSpouses(a).set(b, !!r.ended);
        ensureSpouses(b).set(a, !!r.ended);
        break;
    }
  }

  // Two people who are both a parent of the same child are a couple, even if nobody recorded a marriage,
  // so they are drawn side by side (and a parent shows up when centering on their partner).
  for (const m of members) {
    const parents = [...parentMap.get(m.id)!];
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const a = ensureSpouses(parents[i]);
        if (!a.has(parents[j])) {
          a.set(parents[j], false);
          ensureSpouses(parents[j]).set(parents[i], false);
        }
      }
    }
  }

  for (const m of members) {
    const parents = parentMap.get(m.id)!;
    if (parents.size === 1) {
      const [only] = parents;
      for (const [spouseId, ended] of spouseMap.get(only) ?? []) {
        // A former spouse isn't assumed to be the other parent.
        if (!ended && !parents.has(spouseId)) {
          parents.add(spouseId);
          ensure(childMap, spouseId).add(m.id);
        }
      }
    }
  }

  // Brothers and sisters are drawn oldest first (people without a birth date go last, in the order entered).
  const byId = new Map(members.map((m) => [m.id, m]));
  const birthOrder = (ids: Set<number>) =>
    [...ids].sort((x, y) => {
      const bx = byId.get(x)?.birth_date ?? null;
      const by = byId.get(y)?.birth_date ?? null;
      if (bx && by && bx !== by) return bx < by ? -1 : 1;
      if (bx && !by) return -1;
      if (!bx && by) return 1;
      return x - y;
    });

  return members.map((m): FTNode => ({
    id: String(m.id),
    gender: (m.gender === "female" ? "female" : "male") as unknown as G,
    parents: [...parentMap.get(m.id)!].map((id) => ({ id: String(id), type: blood })),
    children: birthOrder(childMap.get(m.id)!).map((id) => ({ id: String(id), type: blood })),
    siblings: birthOrder(siblingMap.get(m.id)!).map((id) => ({ id: String(id), type: blood })),
    spouses: [...spouseMap.get(m.id)!].map(([id, ended]) => ({ id: String(id), type: ended ? divorced : married })),
  }));
}

