import { appRunner } from "../data/sql";
import { albumsLinkedTo, getLinkedIds, getStoryRelations, replaceLinks, storiesLinkedTo, type LinkedItem, type LinkTable, type StoryRelations } from "../data/links";
import { listAlbums } from "./gallery";

export type { LinkedItem, StoryRelations };

export function getRelationsForStory(storyId: number): Promise<StoryRelations> {
  return getStoryRelations(appRunner, storyId);
}

/** Linked records and fallback thumbnails for one kind of card, keyed by that record's id. */
export interface LinkContext {
  stories: Map<number, LinkedItem[]>;
  albums: Map<number, LinkedItem[]>;
  /** Image used when the record has none of its own: first linked album cover, then first linked story cover. */
  thumbnails: Map<number, string>;
}

async function albumCovers(): Promise<Map<number, string>> {
  const albums = await listAlbums();
  const out = new Map<number, string>();
  for (const a of albums) {
    const cover = a.cover_path ?? a.cover_image;
    if (cover) out.set(a.id, cover);
  }
  return out;
}

async function storyCovers(): Promise<Map<number, string>> {
  const rows = await appRunner.select<{ id: number; featured_image_path: string }>(
    "SELECT id, featured_image_path FROM stories WHERE status = 'published' AND featured_image_path IS NOT NULL"
  );
  return new Map(rows.map((r) => [r.id, r.featured_image_path]));
}

function firstCover(items: LinkedItem[] | undefined, covers: Map<number, string>): string | undefined {
  for (const it of items ?? []) {
    const c = covers.get(it.id);
    if (c) return c;
  }
  return undefined;
}

/** Mirrors the public site: a milestone's thumbnail falls back to a linked album cover, then a linked story's cover. */
export async function loadMilestoneLinks(): Promise<LinkContext> {
  const [stories, albums, aCovers, sCovers] = await Promise.all([
    storiesLinkedTo(appRunner, "story_milestones", "milestone_id"),
    albumsLinkedTo(appRunner, "album_milestones", "milestone_id"),
    albumCovers(),
    storyCovers(),
  ]);
  const thumbnails = new Map<number, string>();
  for (const id of new Set([...stories.keys(), ...albums.keys()])) {
    const t = firstCover(albums.get(id), aCovers) ?? firstCover(stories.get(id), sCovers);
    if (t) thumbnails.set(id, t);
  }
  return { stories, albums, thumbnails };
}

/** Career entries and places fall back to a linked album cover only. */
export async function loadCareerLinks(): Promise<LinkContext> {
  const [stories, albums, aCovers] = await Promise.all([
    storiesLinkedTo(appRunner, "story_career_entries", "career_entry_id"),
    albumsLinkedTo(appRunner, "album_career_entries", "career_entry_id"),
    albumCovers(),
  ]);
  const thumbnails = new Map<number, string>();
  for (const [id, items] of albums) {
    const t = firstCover(items, aCovers);
    if (t) thumbnails.set(id, t);
  }
  return { stories, albums, thumbnails };
}

export async function loadMapPinLinks(): Promise<LinkContext> {
  const [stories, albums, aCovers] = await Promise.all([
    storiesLinkedTo(appRunner, "story_map_pins", "map_pin_id"),
    albumsLinkedTo(appRunner, "album_map_pins", "map_pin_id"),
    albumCovers(),
  ]);
  const thumbnails = new Map<number, string>();
  for (const [id, items] of albums) {
    const t = firstCover(items, aCovers);
    if (t) thumbnails.set(id, t);
  }
  return { stories, albums, thumbnails };
}

// ── Editing a story's Related Entries ────────────────────────────────────────

export type StoryLinkKind = "milestones" | "albums" | "mapPins" | "career";

const STORY_LINK_TABLES: Record<StoryLinkKind, { table: LinkTable; otherCol: string }> = {
  milestones: { table: "story_milestones", otherCol: "milestone_id" },
  albums: { table: "story_albums", otherCol: "album_id" },
  mapPins: { table: "story_map_pins", otherCol: "map_pin_id" },
  career: { table: "story_career_entries", otherCol: "career_entry_id" },
};

export interface LinkableEntry {
  id: number;
  label: string;
  detail: string | null;
}

/** Everything a story can be linked to, labelled for a checklist. */
export async function listLinkableEntries(): Promise<Record<StoryLinkKind, LinkableEntry[]>> {
  const [milestones, albums, pins, career] = await Promise.all([
    appRunner.select<{ id: number; title: string; date: string }>("SELECT id, title, date FROM milestones ORDER BY date"),
    appRunner.select<{ id: number; name: string }>("SELECT id, name FROM albums ORDER BY name"),
    appRunner.select<{ id: number; name: string }>("SELECT id, name FROM map_pins ORDER BY name"),
    appRunner.select<{ id: number; organization: string; title: string | null }>(
      "SELECT id, organization, title FROM career_entries ORDER BY COALESCE(start_date, '') DESC"
    ),
  ]);
  return {
    milestones: milestones.map((m) => ({ id: m.id, label: m.title, detail: m.date.substring(0, 4) })),
    albums: albums.map((a) => ({ id: a.id, label: a.name, detail: null })),
    mapPins: pins.map((p) => ({ id: p.id, label: p.name, detail: null })),
    career: career.map((c) => ({ id: c.id, label: c.title ? `${c.title} @ ${c.organization}` : c.organization, detail: null })),
  };
}

export async function getStoryLinkIds(storyId: number): Promise<Record<StoryLinkKind, number[]>> {
  const entries = await Promise.all(
    (Object.keys(STORY_LINK_TABLES) as StoryLinkKind[]).map(
      async (k) => [k, await getLinkedIds(appRunner, STORY_LINK_TABLES[k].table, "story_id", storyId)] as const
    )
  );
  return Object.fromEntries(entries) as Record<StoryLinkKind, number[]>;
}

export async function setStoryLinks(storyId: number, kind: StoryLinkKind, ids: number[]): Promise<void> {
  await replaceLinks(appRunner, STORY_LINK_TABLES[kind].table, "story_id", storyId, ids);
  // A link change counts as an edit to the story (sync, "last edited").
  await appRunner.execute("UPDATE stories SET updated_at = datetime('now') WHERE id = ?", [storyId]);
}
