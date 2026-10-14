import { query, execute } from "../db";
import { appRunner } from "../data/sql";
import * as family from "../data/family";
import type { FamilyMember, FamilyRelationship } from "../models";

export type { RelationshipType } from "../data/family";
export { RELATIONSHIP_TYPES, RELATIONSHIP_PHRASES, describeRelationship } from "../data/family";

export interface FamilyMemberInput {
  given_name: string;
  surname?: string | null;
  birth_surname?: string | null;
  nickname?: string | null;
  suffix?: string | null;
  gender?: "male" | "female" | "other" | null;
  birth_date?: string | null;
  death_date?: string | null;
  birth_place?: string | null;
  bio?: string | null;
  photo_path?: string | null;
}

export async function listFamilyMembers(): Promise<FamilyMember[]> {
  return query<FamilyMember>("SELECT * FROM family_members ORDER BY COALESCE(position, 1000000), surname, given_name");
}

export async function getFamilyMember(id: number): Promise<FamilyMember | null> {
  const rows = await query<FamilyMember>("SELECT * FROM family_members WHERE id = ?", [id]);
  return rows[0] ?? null;
}

const COLUMNS = ["given_name", "surname", "birth_surname", "nickname", "suffix", "gender", "birth_date", "death_date", "birth_place", "bio", "photo_path"] as const;

export async function createFamilyMember(data: FamilyMemberInput): Promise<FamilyMember> {
  const result = await execute(
    `INSERT INTO family_members (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")})`,
    COLUMNS.map((c) => data[c] ?? null)
  );
  return (await getFamilyMember(result.lastInsertId))!;
}

export async function updateFamilyMember(id: number, data: Partial<FamilyMemberInput>): Promise<FamilyMember> {
  const fields = COLUMNS.filter((c) => c in data);
  if (fields.length === 0) return (await getFamilyMember(id))!;
  await execute(
    `UPDATE family_members SET ${fields.map((f) => `${f} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ?`,
    [...fields.map((f) => data[f] ?? null), id]
  );
  return (await getFamilyMember(id))!;
}

/** Deletes the member and every relationship that mentions them. */
export const deleteFamilyMember = (id: number) => family.deleteFamilyMember(appRunner, id);

export async function listRelationships(memberId?: number): Promise<FamilyRelationship[]> {
  if (memberId !== undefined) {
    return query<FamilyRelationship>("SELECT * FROM family_relationships WHERE from_member_id = ? OR to_member_id = ?", [memberId, memberId]);
  }
  return query<FamilyRelationship>("SELECT * FROM family_relationships");
}

/** Throws a readable Error for self-relationships and duplicates (in either direction). */
export async function addRelationship(fromMemberId: number, toMemberId: number, type: family.RelationshipType): Promise<void> {
  await family.addRelationship(appRunner, fromMemberId, toMemberId, type);
  // A relationship change is an edit to both people.
  await execute("UPDATE family_members SET updated_at = datetime('now') WHERE id IN (?, ?)", [fromMemberId, toMemberId]);
}

export async function removeRelationship(id: number): Promise<void> {
  const rows = await query<FamilyRelationship>("SELECT * FROM family_relationships WHERE id = ?", [id]);
  await family.removeRelationship(appRunner, id);
  if (rows[0]) {
    await execute("UPDATE family_members SET updated_at = datetime('now') WHERE id IN (?, ?)", [rows[0].from_member_id, rows[0].to_member_id]);
  }
}

/** Mark a marriage as ended (divorced), or current again. */
export async function setRelationshipEnded(id: number, ended: boolean): Promise<void> {
  const rows = await query<FamilyRelationship>("SELECT * FROM family_relationships WHERE id = ?", [id]);
  await family.setRelationshipEnded(appRunner, id, ended);
  if (rows[0]) {
    await execute("UPDATE family_members SET updated_at = datetime('now') WHERE id IN (?, ?)", [rows[0].from_member_id, rows[0].to_member_id]);
  }
}
