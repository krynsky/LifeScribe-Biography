import { LINKS, getLinkedIds, replaceLinks, type LinkTable } from "./links";
import type { SqlRunner } from "./sql";

/**
 * Milestones, career entries and places can each be linked to stories and albums. These helpers
 * read/replace those links from the entity's side (the story editor handles the story side).
 */
export const ENTITY_LINK_KINDS = {
  milestone: { table: "milestones", ownerCol: "milestone_id", stories: "story_milestones", albums: "album_milestones" },
  career: { table: "career_entries", ownerCol: "career_entry_id", stories: "story_career_entries", albums: "album_career_entries" },
  map_pin: { table: "map_pins", ownerCol: "map_pin_id", stories: "story_map_pins", albums: "album_map_pins" },
} as const satisfies Record<string, { table: string; ownerCol: string; stories: LinkTable; albums: LinkTable }>;

export type EntityLinkKind = keyof typeof ENTITY_LINK_KINDS;

export interface EntityLinks {
  stories: number[];
  albums: number[];
}

export async function getEntityLinks(r: SqlRunner, kind: EntityLinkKind, id: number): Promise<EntityLinks> {
  const k = ENTITY_LINK_KINDS[kind];
  const [stories, albums] = await Promise.all([
    getLinkedIds(r, k.stories, k.ownerCol, id),
    getLinkedIds(r, k.albums, k.ownerCol, id),
  ]);
  return { stories, albums };
}

/** Replace the entity's linked stories and/or albums; a key left undefined is untouched. */
export async function setEntityLinks(r: SqlRunner, kind: EntityLinkKind, id: number, links: Partial<EntityLinks>): Promise<void> {
  const k = ENTITY_LINK_KINDS[kind];
  if (links.stories) await replaceLinks(r, k.stories, k.ownerCol, id, links.stories);
  if (links.albums) await replaceLinks(r, k.albums, k.ownerCol, id, links.albums);
}

/** Remove every link row that points at this entity (call before deleting it). */
export async function deleteEntityLinks(r: SqlRunner, kind: EntityLinkKind, id: number): Promise<void> {
  const k = ENTITY_LINK_KINDS[kind];
  for (const table of [k.stories, k.albums]) {
    const def = LINKS[table];
    const col = (def.a[0] as string) === k.ownerCol ? def.a[0] : def.b[0];
    await r.execute(`DELETE FROM ${table} WHERE ${col} = ?`, [id]);
  }
}
