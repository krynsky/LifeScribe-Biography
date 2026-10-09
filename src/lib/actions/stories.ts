import { query, execute } from "../db";
import type { Story } from "../models";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "../data/select";
import { appRunner } from "../data/sql";
import { ensureCategory, setTags } from "../data/taxonomy";

export interface CreateStoryInput {
  title: string;
  content?: string;
  excerpt?: string;
  status?: "draft" | "published";
  event_date?: string;
  event_date_precision?: "year" | "month" | "day";
  featured_image_path?: string | null;
  category_id?: number | null;
  /** Tag names; the story's tags become exactly these. */
  tags?: string[];
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
  let sql = `SELECT s.*, ${CATEGORY_SELECT}, ${tagsSelect("story", "s")} FROM stories s ${categoryJoin("s")}`;
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters?.status) {
    conditions.push("s.status = ?");
    params.push(filters.status);
  }
  if (filters?.search) {
    conditions.push("(s.title LIKE ? OR s.excerpt LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY COALESCE(s.event_date, s.created_at) DESC";

  return query<Story>(sql, params);
}

export async function getStory(id: number): Promise<Story | null> {
  const rows = await query<Story>(
    `SELECT s.*, ${CATEGORY_SELECT}, ${tagsSelect("story", "s")} FROM stories s ${categoryJoin("s")} WHERE s.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createStory(input: CreateStoryInput): Promise<Story> {
  const slug = slugify(input.title);
  const result = await execute(
    `INSERT INTO stories (title, slug, content, excerpt, status, event_date, event_date_precision, featured_image_path, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      slug,
      input.content ?? null,
      input.excerpt ?? null,
      input.status ?? "draft",
      input.event_date ?? null,
      input.event_date_precision ?? "day",
      input.featured_image_path ?? null,
      input.category_id ?? null,
    ]
  );
  if (input.tags) await setTags(appRunner, "stories", result.lastInsertId, input.tags);
  return (await getStory(result.lastInsertId))!;
}

export async function updateStory(input: UpdateStoryInput): Promise<Story> {
  const { id, tags, ...data } = input;
  const patch: Record<string, unknown> = { ...data };
  if (tags) await setTags(appRunner, "stories", id, tags);
  if (data.title !== undefined) patch.slug = slugify(data.title);
  const fields = Object.keys(patch);
  if (fields.length === 0) {
    if (tags) await execute("UPDATE stories SET updated_at = datetime('now') WHERE id = ?", [id]);
    return (await getStory(id))!;
  }

  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => patch[f]);

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
