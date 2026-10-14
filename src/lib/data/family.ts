import type { SqlRunner } from "./sql";

/** The four relationship types the web editor accepts (and therefore the ones the app offers). */
export const RELATIONSHIP_TYPES = ["parent", "child", "sibling", "spouse"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export interface RelationshipRow {
  id: number;
  from_member_id: number;
  to_member_id: number;
  relationship_type: string;
  /** 1 when a spouse relationship has ended (divorced). */
  ended?: number;
}

/**
 * Wording for "<this person> … <other person>", same phrases as the web editor. `from` is the
 * person the sentence starts with.
 */
export const RELATIONSHIP_PHRASES: Record<RelationshipType, string> = {
  parent: "is a parent of",
  child: "is a child of",
  sibling: "is a sibling of",
  spouse: "is married to",
};

const INVERSE: Record<RelationshipType, RelationshipType> = {
  parent: "child",
  child: "parent",
  sibling: "sibling",
  spouse: "spouse",
};

const isKnownType = (t: string): t is RelationshipType => (RELATIONSHIP_TYPES as readonly string[]).includes(t);

/**
 * A direction-independent identity for a relationship, so "A is a parent of B" and
 * "B is a child of A" (or "A is married to B" / "B is married to A") are recognised as the same fact.
 * Returns null for types the app doesn't model.
 */
export function relationshipKey(from: number, to: number, type: string): string | null {
  if (!isKnownType(type)) return null;
  switch (type) {
    case "parent":
      return `parent:${from}:${to}`;
    case "child":
      return `parent:${to}:${from}`;
    default:
      return `${type}:${Math.min(from, to)}:${Math.max(from, to)}`;
  }
}

/** How one relationship reads from `memberId`'s side: the other person and the phrase to show. */
export function describeRelationship(rel: RelationshipRow, memberId: number): { otherId: number; type: RelationshipType; phrase: string } | null {
  if (!isKnownType(rel.relationship_type)) return null;
  const fromThisSide = rel.from_member_id === memberId;
  if (!fromThisSide && rel.to_member_id !== memberId) return null;
  const type = fromThisSide ? rel.relationship_type : INVERSE[rel.relationship_type];
  return {
    otherId: fromThisSide ? rel.to_member_id : rel.from_member_id,
    type,
    phrase: type === "spouse" && rel.ended ? "was married to" : RELATIONSHIP_PHRASES[type],
  };
}

export async function listRelationships(r: SqlRunner): Promise<RelationshipRow[]> {
  return r.select<RelationshipRow>("SELECT id, from_member_id, to_member_id, relationship_type, ended FROM family_relationships ORDER BY id");
}

/** Add a relationship, refusing self-relationships and anything that already exists in either direction. */
export async function addRelationship(r: SqlRunner, from: number, to: number, type: RelationshipType): Promise<void> {
  if (from === to) throw new Error("A person cannot have a relationship with themselves.");
  if (!isKnownType(type)) throw new Error("Invalid relationship type.");
  const key = relationshipKey(from, to, type);
  const existing = await listRelationships(r);
  if (existing.some((e) => relationshipKey(e.from_member_id, e.to_member_id, e.relationship_type) === key)) {
    throw new Error("This relationship already exists.");
  }
  await r.execute("INSERT INTO family_relationships (from_member_id, to_member_id, relationship_type) VALUES (?, ?, ?)", [from, to, type]);
}

/** Mark a marriage as ended (or current again). Only spouse relationships can end. */
export async function setRelationshipEnded(r: SqlRunner, id: number, ended: boolean): Promise<void> {
  await r.execute("UPDATE family_relationships SET ended = ? WHERE id = ? AND relationship_type = 'spouse'", [ended ? 1 : 0, id]);
}

export async function removeRelationship(r: SqlRunner, id: number): Promise<void> {
  await r.execute("DELETE FROM family_relationships WHERE id = ?", [id]);
}

/** Delete a member together with every relationship that mentions them. */
export async function deleteFamilyMember(r: SqlRunner, id: number): Promise<void> {
  await r.execute("DELETE FROM family_relationships WHERE from_member_id = ? OR to_member_id = ?", [id, id]);
  await r.execute("DELETE FROM family_members WHERE id = ?", [id]);
}
