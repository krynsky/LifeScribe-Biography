import type { Album } from "../models";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "./select";
import type { SqlRunner } from "./sql";

export type AlbumListItem = Album & { media_count: number; cover_path: string | null };

/**
 * Every album with its photo count, category, tags and a cover image path. The cover is, in order:
 * the photo the user chose (`cover_media_id`), the photo matching the cover URL synced from the web,
 * then the album's first photo.
 */
export async function listAlbumsWithCovers(r: SqlRunner): Promise<AlbumListItem[]> {
  const albums = await r.select<Album & { media_count: number }>(
    `SELECT a.*, ${CATEGORY_SELECT}, ${tagsSelect("album", "a")}, COUNT(m.id) AS media_count
       FROM albums a
       ${categoryJoin("a")}
       LEFT JOIN media m ON m.album_id = a.id
      GROUP BY a.id
      ORDER BY COALESCE(a.position, 1000000), a.created_at DESC`
  );

  const out: AlbumListItem[] = [];
  for (const a of albums) {
    let cover: string | null = null;

    if (a.cover_media_id) {
      const chosen = await r.select<{ thumbnail_path: string | null; file_path: string }>(
        "SELECT thumbnail_path, file_path FROM media WHERE id = ? AND album_id = ?",
        [a.cover_media_id, a.id]
      );
      cover = chosen[0] ? (chosen[0].thumbnail_path ?? chosen[0].file_path) : null;
    }
    if (!cover) {
      const coverImage = a.cover_image ?? null;
      const rows = await r.select<{ thumbnail_path: string }>(
        `SELECT thumbnail_path FROM media
          WHERE album_id = ? AND thumbnail_path IS NOT NULL
          ORDER BY CASE WHEN ? IS NOT NULL AND remote_url = ? THEN 0 ELSE 1 END, sort_order, id
          LIMIT 1`,
        [a.id, coverImage, coverImage]
      );
      cover = rows[0]?.thumbnail_path ?? null;
    }
    out.push({ ...a, cover_path: cover });
  }
  return out;
}

/** Choose (or clear, with null) the photo shown as the album's cover. The photo must be in the album. */
export async function setAlbumCover(r: SqlRunner, albumId: number, mediaId: number | null): Promise<void> {
  if (mediaId !== null) {
    const rows = await r.select<{ id: number }>("SELECT id FROM media WHERE id = ? AND album_id = ?", [mediaId, albumId]);
    if (rows.length === 0) throw new Error("That photo isn't in this album.");
  }
  // Clearing the explicit choice also clears any synced cover URL so the new choice wins.
  await r.execute("UPDATE albums SET cover_media_id = ?, cover_image = NULL, updated_at = datetime('now') WHERE id = ?", [mediaId, albumId]);
}

/** Remove one photo/video. If it was an album's cover, that album falls back to its first photo. */
export async function deleteMedia(r: SqlRunner, id: number): Promise<void> {
  // Removing a photo is an edit to its album (so the album shows up as changed for publishing).
  await r.execute("UPDATE albums SET updated_at = datetime('now') WHERE id = (SELECT album_id FROM media WHERE id = ?)", [id]);
  await r.execute("UPDATE albums SET cover_media_id = NULL WHERE cover_media_id = ?", [id]);
  await r.execute("DELETE FROM media_map_pins WHERE media_id = ?", [id]);
  await r.execute("DELETE FROM media WHERE id = ?", [id]);
}

/**
 * Delete an album. Its photos are kept (they just leave the album), matching the web; the album's
 * tags and links to stories, milestones, places and career entries are removed.
 */
export async function deleteAlbum(r: SqlRunner, id: number): Promise<void> {
  await r.execute("UPDATE media SET album_id = NULL WHERE album_id = ?", [id]);
  for (const table of ["album_tags", "story_albums", "album_milestones", "album_map_pins", "album_career_entries"]) {
    await r.execute(`DELETE FROM ${table} WHERE album_id = ?`, [id]);
  }
  await r.execute("DELETE FROM albums WHERE id = ?", [id]);
}
