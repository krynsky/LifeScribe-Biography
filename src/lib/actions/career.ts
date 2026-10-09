import { query, execute } from "../db";
import type { CareerEntry } from "../models";
import { CATEGORY_SELECT, categoryJoin } from "../data/select";
import { appRunner } from "../data/sql";
import { deleteEntityLinks } from "../data/entity-links";

export async function listCareerEntries(): Promise<CareerEntry[]> {
  return query<CareerEntry>(
    `SELECT e.*, ${CATEGORY_SELECT} FROM career_entries e ${categoryJoin("e")}
     ORDER BY e.is_current DESC, COALESCE(e.start_date, '0000') DESC`
  );
}

export async function getCareerEntry(id: number): Promise<CareerEntry | null> {
  const rows = await query<CareerEntry>(
    `SELECT e.*, ${CATEGORY_SELECT} FROM career_entries e ${categoryJoin("e")} WHERE e.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createCareerEntry(data: {
  entry_type?: "job" | "education";
  organization: string;
  title?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  location?: string | null;
  logo_path?: string | null;
  employment_type?: string | null;
  category_id?: number | null;
}): Promise<CareerEntry> {
  const result = await execute(
    `INSERT INTO career_entries
      (entry_type, organization, title, description, start_date, end_date, is_current, location, logo_path, employment_type, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.entry_type ?? "job",
      data.organization,
      data.title ?? null,
      data.description ?? null,
      data.start_date ?? null,
      data.end_date ?? null,
      data.is_current ? 1 : 0,
      data.location ?? null,
      data.logo_path ?? null,
      data.employment_type ?? null,
      data.category_id ?? null,
    ]
  );
  return (await getCareerEntry(result.lastInsertId))!;
}

export async function updateCareerEntry(
  id: number,
  data: Partial<Parameters<typeof createCareerEntry>[0]>
): Promise<CareerEntry> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getCareerEntry(id))!;
  const setClauses = fields
    .map((f) => `${f} = ?`)
    .join(", ");
  const values = fields.map((f) =>
    f === "is_current" ? (data[f] ? 1 : 0) : data[f]
  );
  await execute(
    `UPDATE career_entries SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getCareerEntry(id))!;
}

export async function deleteCareerEntry(id: number): Promise<void> {
  await deleteEntityLinks(appRunner, "career", id);
  await execute("DELETE FROM career_entries WHERE id = ?", [id]);
}
