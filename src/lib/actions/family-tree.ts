import { query, execute } from "../db";
import type { FamilyMember, FamilyRelationship } from "../models";

export async function listFamilyMembers(): Promise<FamilyMember[]> {
  return query<FamilyMember>("SELECT * FROM family_members ORDER BY surname, given_name");
}

export async function getFamilyMember(id: number): Promise<FamilyMember | null> {
  const rows = await query<FamilyMember>("SELECT * FROM family_members WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createFamilyMember(data: {
  given_name: string;
  surname?: string;
  birth_date?: string;
  death_date?: string;
  birth_place?: string;
  bio?: string;
  photo_path?: string;
}): Promise<FamilyMember> {
  const result = await execute(
    `INSERT INTO family_members (given_name, surname, birth_date, death_date, birth_place, bio, photo_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.given_name,
      data.surname ?? null,
      data.birth_date ?? null,
      data.death_date ?? null,
      data.birth_place ?? null,
      data.bio ?? null,
      data.photo_path ?? null,
    ]
  );
  return (await getFamilyMember(result.lastInsertId))!;
}

export async function updateFamilyMember(
  id: number,
  data: {
    given_name?: string;
    surname?: string;
    birth_date?: string | null;
    death_date?: string | null;
    birth_place?: string | null;
    bio?: string | null;
    photo_path?: string | null;
  }
): Promise<FamilyMember> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getFamilyMember(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);
  await execute(
    `UPDATE family_members SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getFamilyMember(id))!;
}

export async function deleteFamilyMember(id: number): Promise<void> {
  await execute("DELETE FROM family_members WHERE id = ?", [id]);
}

export async function listRelationships(memberId?: number): Promise<FamilyRelationship[]> {
  if (memberId !== undefined) {
    return query<FamilyRelationship>(
      "SELECT * FROM family_relationships WHERE from_member_id = ? OR to_member_id = ?",
      [memberId, memberId]
    );
  }
  return query<FamilyRelationship>("SELECT * FROM family_relationships");
}

export async function addRelationship(
  fromMemberId: number,
  toMemberId: number,
  relationshipType: FamilyRelationship["relationship_type"]
): Promise<void> {
  await execute(
    `INSERT OR IGNORE INTO family_relationships (from_member_id, to_member_id, relationship_type)
     VALUES (?, ?, ?)`,
    [fromMemberId, toMemberId, relationshipType]
  );
}

export async function removeRelationship(id: number): Promise<void> {
  await execute("DELETE FROM family_relationships WHERE id = ?", [id]);
}
