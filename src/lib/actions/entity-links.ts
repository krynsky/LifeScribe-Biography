import { appRunner } from "../data/sql";
import * as links from "../data/entity-links";

export type { EntityLinkKind, EntityLinks } from "../data/entity-links";

export const getEntityLinks = (kind: links.EntityLinkKind, id: number) => links.getEntityLinks(appRunner, kind, id);

/** Replace an entity's linked stories/albums and mark the entity as edited (so sync notices). */
export async function setEntityLinks(kind: links.EntityLinkKind, id: number, value: Partial<links.EntityLinks>): Promise<void> {
  await links.setEntityLinks(appRunner, kind, id, value);
  await appRunner.execute(`UPDATE ${links.ENTITY_LINK_KINDS[kind].table} SET updated_at = datetime('now') WHERE id = ?`, [id]);
}

export interface LinkTarget {
  id: number;
  label: string;
}

/** Every story and album an entity can be linked to. */
export async function listLinkTargets(): Promise<{ stories: LinkTarget[]; albums: LinkTarget[] }> {
  const [stories, albums] = await Promise.all([
    appRunner.select<{ id: number; title: string }>("SELECT id, title FROM stories ORDER BY COALESCE(event_date, created_at) DESC"),
    appRunner.select<{ id: number; name: string }>("SELECT id, name FROM albums ORDER BY name"),
  ]);
  return {
    stories: stories.map((s) => ({ id: s.id, label: s.title })),
    albums: albums.map((a) => ({ id: a.id, label: a.name })),
  };
}
