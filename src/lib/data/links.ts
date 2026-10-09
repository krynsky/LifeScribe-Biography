import type { SqlRunner } from "./sql";

/**
 * The seven many-to-many link tables between content types, mirroring the web's Related Entries.
 * Each pairs two entity tables; `a` is the first-named side in the table name.
 */
export const LINKS = {
  story_milestones: { a: ["story_id", "stories"], b: ["milestone_id", "milestones"] },
  story_albums: { a: ["story_id", "stories"], b: ["album_id", "albums"] },
  story_map_pins: { a: ["story_id", "stories"], b: ["map_pin_id", "map_pins"] },
  story_career_entries: { a: ["story_id", "stories"], b: ["career_entry_id", "career_entries"] },
  album_milestones: { a: ["album_id", "albums"], b: ["milestone_id", "milestones"] },
  album_map_pins: { a: ["album_id", "albums"], b: ["map_pin_id", "map_pins"] },
  album_career_entries: { a: ["album_id", "albums"], b: ["career_entry_id", "career_entries"] },
} as const;

export type LinkTable = keyof typeof LINKS;

/** Ids on the other side of a link, for one owner row. `ownerCol` names the owner's column. */
export async function getLinkedIds(r: SqlRunner, table: LinkTable, ownerCol: string, ownerId: number): Promise<number[]> {
  const def = LINKS[table];
  const otherCol = def.a[0] === ownerCol ? def.b[0] : def.a[0];
  const rows = await r.select<Record<string, number>>(`SELECT ${otherCol} AS id FROM ${table} WHERE ${ownerCol} = ?`, [ownerId]);
  return rows.map((x) => x.id);
}

/** Replace all of one owner's links in `table` with exactly `otherIds`. */
export async function replaceLinks(
  r: SqlRunner,
  table: LinkTable,
  ownerCol: string,
  ownerId: number,
  otherIds: number[]
): Promise<void> {
  const def = LINKS[table];
  if (ownerCol !== def.a[0] && ownerCol !== def.b[0]) throw new Error(`${ownerCol} is not a column of ${table}`);
  const otherCol = def.a[0] === ownerCol ? def.b[0] : def.a[0];
  await r.execute(`DELETE FROM ${table} WHERE ${ownerCol} = ?`, [ownerId]);
  for (const id of new Set(otherIds)) {
    await r.execute(`INSERT OR IGNORE INTO ${table} (${ownerCol}, ${otherCol}) VALUES (?, ?)`, [ownerId, id]);
  }
}

export async function addLink(r: SqlRunner, table: LinkTable, aId: number, bId: number): Promise<void> {
  const def = LINKS[table];
  await r.execute(`INSERT OR IGNORE INTO ${table} (${def.a[0]}, ${def.b[0]}) VALUES (?, ?)`, [aId, bId]);
}

export async function removeLink(r: SqlRunner, table: LinkTable, aId: number, bId: number): Promise<void> {
  const def = LINKS[table];
  await r.execute(`DELETE FROM ${table} WHERE ${def.a[0]} = ? AND ${def.b[0]} = ?`, [aId, bId]);
}

// ── Read helpers for the read-mode views ─────────────────────────────────────

export interface LinkedItem {
  id: number;
  title: string;
}

/** Published stories linked to each owner row, keyed by the owner's id. */
export async function storiesLinkedTo(
  r: SqlRunner,
  table: "story_milestones" | "story_map_pins" | "story_career_entries",
  ownerCol: "milestone_id" | "map_pin_id" | "career_entry_id"
): Promise<Map<number, LinkedItem[]>> {
  const rows = await r.select<{ owner: number; id: number; title: string }>(
    `SELECT l.${ownerCol} AS owner, s.id AS id, s.title AS title
       FROM ${table} l JOIN stories s ON s.id = l.story_id
      WHERE s.status = 'published' ORDER BY COALESCE(s.event_date, s.created_at) DESC`
  );
  return groupItems(rows);
}

/** Albums linked to each owner row, keyed by the owner's id. */
export async function albumsLinkedTo(
  r: SqlRunner,
  table: "album_career_entries" | "album_map_pins" | "album_milestones",
  ownerCol: "career_entry_id" | "map_pin_id" | "milestone_id"
): Promise<Map<number, LinkedItem[]>> {
  const rows = await r.select<{ owner: number; id: number; title: string }>(
    `SELECT l.${ownerCol} AS owner, a.id AS id, a.name AS title
       FROM ${table} l JOIN albums a ON a.id = l.album_id ORDER BY a.name`
  );
  return groupItems(rows);
}

function groupItems(rows: { owner: number; id: number; title: string }[]): Map<number, LinkedItem[]> {
  const out = new Map<number, LinkedItem[]>();
  for (const row of rows) {
    const list = out.get(row.owner) ?? [];
    list.push({ id: row.id, title: row.title });
    out.set(row.owner, list);
  }
  return out;
}

export interface StoryRelations {
  milestones: { id: number; title: string; year: string }[];
  albums: LinkedItem[];
  mapPins: { id: number; name: string }[];
  career: { id: number; title: string | null; company: string }[];
}

/** Everything linked to one story, for the "Related Entries" box. */
export async function getStoryRelations(r: SqlRunner, storyId: number): Promise<StoryRelations> {
  const [milestones, albums, mapPins, career] = await Promise.all([
    r.select<{ id: number; title: string; date: string }>(
      "SELECT m.id, m.title, m.date FROM story_milestones l JOIN milestones m ON m.id = l.milestone_id WHERE l.story_id = ? ORDER BY m.date",
      [storyId]
    ),
    r.select<{ id: number; title: string }>(
      "SELECT a.id, a.name AS title FROM story_albums l JOIN albums a ON a.id = l.album_id WHERE l.story_id = ? ORDER BY a.name",
      [storyId]
    ),
    r.select<{ id: number; name: string }>(
      "SELECT p.id, p.name FROM story_map_pins l JOIN map_pins p ON p.id = l.map_pin_id WHERE l.story_id = ? ORDER BY p.name",
      [storyId]
    ),
    r.select<{ id: number; title: string | null; company: string }>(
      "SELECT c.id, c.title, c.organization AS company FROM story_career_entries l JOIN career_entries c ON c.id = l.career_entry_id WHERE l.story_id = ? ORDER BY c.start_date DESC",
      [storyId]
    ),
  ]);
  return {
    milestones: milestones.map((m) => ({ id: m.id, title: m.title, year: m.date.substring(0, 4) })),
    albums,
    mapPins,
    career,
  };
}
