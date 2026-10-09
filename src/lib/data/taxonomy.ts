import type { SqlRunner } from "./sql";

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
}

export interface TagRow {
  id: number;
  name: string;
  slug: string;
}

/** Tables that carry a `category_id`. */
export const CATEGORIZED_TABLES = ["stories", "milestones", "career_entries", "map_pins", "albums"] as const;
export type CategorizedTable = (typeof CATEGORIZED_TABLES)[number];

/** Tag join tables, keyed by the owning entity table. */
export const TAG_TABLES = {
  stories: { join: "story_tags", col: "story_id" },
  albums: { join: "album_tags", col: "album_id" },
} as const;
export type TaggedTable = keyof typeof TAG_TABLES;

export const DEFAULT_CATEGORY_COLOR = "#3D7A8A";

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

async function uniqueSlug(r: SqlRunner, table: "categories" | "tags", base: string, ignoreId?: number): Promise<string> {
  let slug = base;
  for (let n = 2; ; n++) {
    const rows = await r.select<{ id: number }>(`SELECT id FROM ${table} WHERE slug = ?`, [slug]);
    if (rows.length === 0 || (ignoreId != null && rows.every((x) => x.id === ignoreId))) return slug;
    slug = `${base}-${n}`;
  }
}

// ── Categories ───────────────────────────────────────────────────────────────

export async function listCategories(r: SqlRunner): Promise<(CategoryRow & { usage: number })[]> {
  const usage = CATEGORIZED_TABLES.map((t) => `(SELECT COUNT(*) FROM ${t} WHERE category_id = c.id)`).join(" + ");
  return r.select(`SELECT c.id, c.name, c.slug, c.color, c.icon, (${usage}) AS usage FROM categories c ORDER BY lower(c.name)`);
}

export async function getCategory(r: SqlRunner, id: number): Promise<CategoryRow | null> {
  const rows = await r.select<CategoryRow>("SELECT id, name, slug, color, icon FROM categories WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createCategory(
  r: SqlRunner,
  input: { name: string; color?: string | null; icon?: string | null }
): Promise<CategoryRow> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");
  const existing = await findCategoryByName(r, name);
  if (existing) throw new Error(`A category named "${existing.name}" already exists`);
  const slug = await uniqueSlug(r, "categories", slugify(name));
  const res = await r.execute("INSERT INTO categories (name, slug, color, icon) VALUES (?, ?, ?, ?)", [
    name,
    slug,
    input.color ?? DEFAULT_CATEGORY_COLOR,
    input.icon ?? null,
  ]);
  return (await getCategory(r, res.lastInsertId))!;
}

async function findCategoryByName(r: SqlRunner, name: string): Promise<CategoryRow | null> {
  const rows = await r.select<CategoryRow>(
    "SELECT id, name, slug, color, icon FROM categories WHERE lower(name) = lower(?)",
    [name.trim()]
  );
  return rows[0] ?? null;
}

/** Find a category by name (case-insensitive) or create it. Returns its id. */
export async function ensureCategory(
  r: SqlRunner,
  name: string,
  color?: string | null,
  icon?: string | null
): Promise<number> {
  const existing = await findCategoryByName(r, name);
  if (existing) return existing.id;
  return (await createCategory(r, { name, color, icon })).id;
}

export async function updateCategory(
  r: SqlRunner,
  id: number,
  patch: { name?: string; color?: string | null; icon?: string | null }
): Promise<CategoryRow> {
  const current = await getCategory(r, id);
  if (!current) throw new Error("Category not found");
  let slug = current.slug;
  let name = current.name;
  if (patch.name !== undefined && patch.name.trim() !== current.name) {
    name = patch.name.trim();
    if (!name) throw new Error("Category name is required");
    const clash = await findCategoryByName(r, name);
    if (clash && clash.id !== id) throw new Error(`A category named "${clash.name}" already exists`);
    slug = await uniqueSlug(r, "categories", slugify(name), id);
  }
  await r.execute("UPDATE categories SET name = ?, slug = ?, color = ?, icon = ? WHERE id = ?", [
    name,
    slug,
    patch.color !== undefined ? patch.color : current.color,
    patch.icon !== undefined ? patch.icon : current.icon,
    id,
  ]);
  return (await getCategory(r, id))!;
}

export async function deleteCategory(r: SqlRunner, id: number): Promise<void> {
  // Clear explicitly rather than relying on ON DELETE SET NULL (foreign keys may be off).
  for (const t of CATEGORIZED_TABLES) await r.execute(`UPDATE ${t} SET category_id = NULL WHERE category_id = ?`, [id]);
  await r.execute("DELETE FROM categories WHERE id = ?", [id]);
}

export async function setCategory(r: SqlRunner, table: CategorizedTable, entityId: number, categoryId: number | null): Promise<void> {
  await r.execute(`UPDATE ${table} SET category_id = ? WHERE id = ?`, [categoryId, entityId]);
}

/** Assign a category by name (creating it when new); null/empty clears it. */
export async function setCategoryByName(
  r: SqlRunner,
  table: CategorizedTable,
  entityId: number,
  cat: { name: string; color?: string | null; icon?: string | null } | null
): Promise<void> {
  if (!cat || !cat.name.trim()) return setCategory(r, table, entityId, null);
  const id = await ensureCategory(r, cat.name, cat.color, cat.icon);
  await setCategory(r, table, entityId, id);
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export async function listTags(r: SqlRunner): Promise<(TagRow & { usage: number })[]> {
  return r.select(
    `SELECT t.id, t.name, t.slug,
       (SELECT COUNT(*) FROM story_tags WHERE tag_id = t.id) + (SELECT COUNT(*) FROM album_tags WHERE tag_id = t.id) AS usage
     FROM tags t ORDER BY lower(t.name)`
  );
}

async function findTagByName(r: SqlRunner, name: string): Promise<TagRow | null> {
  const rows = await r.select<TagRow>("SELECT id, name, slug FROM tags WHERE lower(name) = lower(?)", [name.trim()]);
  return rows[0] ?? null;
}

export async function ensureTag(r: SqlRunner, name: string): Promise<TagRow> {
  const clean = name.trim();
  if (!clean) throw new Error("Tag name is required");
  const existing = await findTagByName(r, clean);
  if (existing) return existing;
  const slug = await uniqueSlug(r, "tags", slugify(clean));
  const res = await r.execute("INSERT INTO tags (name, slug) VALUES (?, ?)", [clean, slug]);
  return { id: res.lastInsertId, name: clean, slug };
}

export async function renameTag(r: SqlRunner, id: number, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new Error("Tag name is required");
  const clash = await findTagByName(r, clean);
  if (clash && clash.id !== id) throw new Error(`A tag named "${clash.name}" already exists — merge them instead`);
  await r.execute("UPDATE tags SET name = ?, slug = ? WHERE id = ?", [clean, await uniqueSlug(r, "tags", slugify(clean), id), id]);
}

export async function deleteTag(r: SqlRunner, id: number): Promise<void> {
  await r.execute("DELETE FROM story_tags WHERE tag_id = ?", [id]);
  await r.execute("DELETE FROM album_tags WHERE tag_id = ?", [id]);
  await r.execute("DELETE FROM tags WHERE id = ?", [id]);
}

/** Move everything tagged `sourceId` onto `targetId`, then delete the source. */
export async function mergeTag(r: SqlRunner, sourceId: number, targetId: number): Promise<void> {
  if (sourceId === targetId) return;
  for (const { join, col } of Object.values(TAG_TABLES)) {
    await r.execute(`INSERT OR IGNORE INTO ${join} (${col}, tag_id) SELECT ${col}, ? FROM ${join} WHERE tag_id = ?`, [targetId, sourceId]);
  }
  await deleteTag(r, sourceId);
}

export async function getTagNames(r: SqlRunner, table: TaggedTable, entityId: number): Promise<string[]> {
  const { join, col } = TAG_TABLES[table];
  const rows = await r.select<{ name: string }>(
    `SELECT t.name FROM ${join} j JOIN tags t ON t.id = j.tag_id WHERE j.${col} = ? ORDER BY lower(t.name)`,
    [entityId]
  );
  return rows.map((x) => x.name);
}

/** Replace an entity's tags with exactly `names`, creating any that don't exist yet. */
export async function setTags(r: SqlRunner, table: TaggedTable, entityId: number, names: string[]): Promise<void> {
  const { join, col } = TAG_TABLES[table];
  const ids = new Set<number>();
  for (const n of names) {
    if (n.trim()) ids.add((await ensureTag(r, n)).id);
  }
  await r.execute(`DELETE FROM ${join} WHERE ${col} = ?`, [entityId]);
  for (const id of ids) await r.execute(`INSERT OR IGNORE INTO ${join} (${col}, tag_id) VALUES (?, ?)`, [entityId, id]);
}
