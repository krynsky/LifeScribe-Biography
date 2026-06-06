import { query, execute } from "../db";
import type { Story } from "../models";

export interface CreateStoryInput {
  title: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "published";
  event_date?: string;
  event_date_precision?: "year" | "month" | "day";
  featured_image_path?: string;
}

export interface UpdateStoryInput extends Partial<CreateStoryInput> {
  id: number;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
}

export async function listStories(filters?: {
  status?: "draft" | "published";
  search?: string;
}): Promise<Story[]> {
  let sql = "SELECT * FROM stories";
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters?.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters?.search) {
    conditions.push("(title LIKE ? OR excerpt LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY COALESCE(event_date, created_at) DESC";

  return query<Story>(sql, params);
}

export async function getStory(id: number): Promise<Story | null> {
  const rows = await query<Story>("SELECT * FROM stories WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const slug = slugify(input.title);
  const result = await execute(
    `INSERT INTO stories (title, slug, content, excerpt, status, event_date, event_date_precision, featured_image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      slug,
      input.content ?? null,
      input.excerpt ?? null,
      input.status ?? "draft",
      input.event_date ?? null,
      input.event_date_precision ?? "day",
      input.featured_image_path ?? null,
    ]
  );
  return (await getStory(result.lastInsertId))!;
}

export async function updateStory(input: UpdateStoryInput): Promise<Story> {
  const { id, ...data } = input;
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getStory(id))!;

  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);

  await execute(
    `UPDATE stories SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getStory(id))!;
}

export async function deleteStory(id: number): Promise<void> {
  await execute("DELETE FROM stories WHERE id = ?", [id]);
}

export async function autosaveStory(id: number, content: string): Promise<void> {
  await execute(
    "UPDATE stories SET content = ?, updated_at = datetime('now') WHERE id = ?",
    [content, id]
  );
}
