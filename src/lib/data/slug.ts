import type { SqlRunner } from "./sql";

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 80)
      .replace(/-+$/g, "") || "story"
  );
}

/** A story slug that no other story uses (appends -2, -3… on collision). */
export async function uniqueStorySlug(r: SqlRunner, title: string, ignoreId?: number): Promise<string> {
  const base = slugifyTitle(title);
  let slug = base;
  for (let n = 2; ; n++) {
    const rows = await r.select<{ id: number }>("SELECT id FROM stories WHERE slug = ?", [slug]);
    if (rows.every((x) => x.id === ignoreId)) return slug;
    slug = `${base}-${n}`;
  }
}
