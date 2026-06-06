import { query, execute } from "../db";
import type { Milestone } from "../models";

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  date: string;
  date_precision?: "year" | "month" | "day";
  category?: string;
  color?: string;
  image_path?: string;
}

export async function listMilestones(): Promise<Milestone[]> {
  return query<Milestone>("SELECT * FROM milestones ORDER BY date ASC, created_at ASC");
}

export async function getMilestone(id: number): Promise<Milestone | null> {
  const rows = await query<Milestone>("SELECT * FROM milestones WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  const result = await execute(
    `INSERT INTO milestones (title, description, date, date_precision, category, color, image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.description ?? null,
      input.date,
      input.date_precision ?? "day",
      input.category ?? null,
      input.color ?? "#3D7A8A",
      input.image_path ?? null,
    ]
  );
  return (await getMilestone(result.lastInsertId))!;
}

export async function updateMilestone(
  id: number,
  data: Partial<CreateMilestoneInput>
): Promise<Milestone> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getMilestone(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);
  await execute(
    `UPDATE milestones SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getMilestone(id))!;
}

export async function deleteMilestone(id: number): Promise<void> {
  await execute("DELETE FROM milestones WHERE id = ?", [id]);
}
