import { query, execute } from "../db";
import type { Milestone } from "../models";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "../data/select";
import { appRunner } from "../data/sql";
import { ensureCategory, setTags } from "../data/taxonomy";
import { deleteEntityLinks } from "../data/entity-links";

export interface CreateMilestoneInput {
  title: string;
  description?: string | null;
  date: string;
  date_precision?: "year" | "month" | "day";
  /** Category name (created if new). Prefer category_id when you already have the id. */
  category?: string | null;
  category_id?: number | null;
  end_date?: string | null;
  end_date_precision?: "year" | "month" | "day" | null;
  color?: string;
  image_path?: string | null;
}

async function resolveCategoryId(input: { category?: string | null; category_id?: number | null }): Promise<number | null | undefined> {
  if (input.category_id !== undefined) return input.category_id;
  if (input.category === undefined) return undefined;
  return input.category && input.category.trim() ? ensureCategory(appRunner, input.category) : null;
}

export async function listMilestones(): Promise<Milestone[]> {
  return query<Milestone>(
    `SELECT m.*, ${CATEGORY_SELECT} FROM milestones m ${categoryJoin("m")} ORDER BY m.date ASC, COALESCE(m.position, 1000000), m.created_at ASC`
  );
}

export async function getMilestone(id: number): Promise<Milestone | null> {
  const rows = await query<Milestone>(
    `SELECT m.*, ${CATEGORY_SELECT} FROM milestones m ${categoryJoin("m")} WHERE m.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  const result = await execute(
    `INSERT INTO milestones (title, description, date, date_precision, category_id, color, image_path, end_date, end_date_precision)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.description ?? null,
      input.date,
      input.date_precision ?? "day",
      (await resolveCategoryId(input)) ?? null,
      input.color ?? "#3D7A8A",
      input.image_path ?? null,
      input.end_date ?? null,
      input.end_date_precision ?? null,
    ]
  );
  return (await getMilestone(result.lastInsertId))!;
}

export async function updateMilestone(
  id: number,
  data: Partial<CreateMilestoneInput>
): Promise<Milestone> {
  const { category, category_id, ...rest } = data;
  const patch: Record<string, unknown> = { ...rest };
  const catId = await resolveCategoryId({ category, category_id });
  if (catId !== undefined) patch.category_id = catId;
  const fields = Object.keys(patch);
  if (fields.length === 0) return (await getMilestone(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f]);
  await execute(
    `UPDATE milestones SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getMilestone(id))!;
}

export async function deleteMilestone(id: number): Promise<void> {
  await deleteEntityLinks(appRunner, "milestone", id);
  await execute("DELETE FROM milestones WHERE id = ?", [id]);
}
