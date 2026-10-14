import { query, execute } from "../db";
import type { Album, Media } from "../models";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "../data/select";
import { appRunner } from "../data/sql";
import { setTags } from "../data/taxonomy";
import * as galleryData from "../data/gallery";

// Albums

export type AlbumListItem = galleryData.AlbumListItem;

export function listAlbums(): Promise<AlbumListItem[]> {
  return galleryData.listAlbumsWithCovers(appRunner);
}

export async function getAlbum(id: number): Promise<Album | null> {
  const rows = await query<Album>(
    `SELECT a.*, ${CATEGORY_SELECT}, ${tagsSelect("album", "a")} FROM albums a ${categoryJoin("a")} WHERE a.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export interface AlbumInput {
  name: string;
  description?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  category_id?: number | null;
  /** Tag names; the album's tags become exactly these. */
  tags?: string[];
}

export async function createAlbum(data: AlbumInput): Promise<Album> {
  const result = await execute(
    "INSERT INTO albums (name, description, date_from, date_to, category_id) VALUES (?, ?, ?, ?, ?)",
    [data.name, data.description ?? null, data.date_from ?? null, data.date_to ?? null, data.category_id ?? null]
  );
  if (data.tags) await setTags(appRunner, "albums", result.lastInsertId, data.tags);
  return (await getAlbum(result.lastInsertId))!;
}

export async function updateAlbum(id: number, data: Partial<AlbumInput> & { cover_media_id?: number | null }): Promise<Album> {
  const { tags, ...rest } = data;
  if (tags) await setTags(appRunner, "albums", id, tags);
  const fields = Object.keys(rest) as (keyof typeof rest)[];
  if (fields.length === 0) {
    if (tags) await execute("UPDATE albums SET updated_at = datetime('now') WHERE id = ?", [id]);
    return (await getAlbum(id))!;
  }
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => rest[f]);
  await execute(`UPDATE albums SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`, [...values, id]);
  return (await getAlbum(id))!;
}

/** Deletes the album but keeps its photos (they just leave the album), like the web. */
export const deleteAlbum = (id: number) => galleryData.deleteAlbum(appRunner, id);

/** Choose which photo represents the album (null clears the choice). */
export const setAlbumCover = (albumId: number, mediaId: number | null) => galleryData.setAlbumCover(appRunner, albumId, mediaId);

// Media

export async function listMedia(filters?: {
  album_id?: number | null;
  search?: string;
}): Promise<Media[]> {
  let sql = "SELECT * FROM media";
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters?.album_id !== undefined) {
    if (filters.album_id === null) {
      conditions.push("album_id IS NULL");
    } else {
      conditions.push("album_id = ?");
      params.push(filters.album_id);
    }
  }
  if (filters?.search) {
    conditions.push("(filename LIKE ? OR title LIKE ? OR caption LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY COALESCE(taken_at, created_at) DESC, sort_order ASC";

  return query<Media>(sql, params);
}

export async function getMedia(id: number): Promise<Media | null> {
  const rows = await query<Media>("SELECT * FROM media WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function insertMedia(data: {
  file_path: string;
  thumbnail_path?: string;
  filename: string;
  title?: string;
  caption?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  taken_at?: string;
  camera_make?: string;
  camera_model?: string;
  latitude?: number;
  longitude?: number;
  album_id?: number;
  import_source?: string;
  import_hash?: string;
  /** Video media: the embed URL played in the lightbox (YouTube, Vimeo…). */
  source_url?: string;
}): Promise<Media> {
  const result = await execute(
    `INSERT OR IGNORE INTO media
      (file_path, thumbnail_path, filename, title, caption, width, height,
       file_size, mime_type, taken_at, camera_make, camera_model,
       latitude, longitude, album_id, import_source, import_hash, source_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.file_path,
      data.thumbnail_path ?? null,
      data.filename,
      data.title ?? null,
      data.caption ?? null,
      data.width ?? null,
      data.height ?? null,
      data.file_size ?? null,
      data.mime_type ?? "image/jpeg",
      data.taken_at ?? null,
      data.camera_make ?? null,
      data.camera_model ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.album_id ?? null,
      data.import_source ?? null,
      data.import_hash ?? null,
      data.source_url ?? null,
    ]
  );
  if (result.rowsAffected > 0 && data.album_id) {
    // Adding a photo is an edit to its album (so the album shows up as changed for publishing).
    await execute("UPDATE albums SET updated_at = datetime('now') WHERE id = ?", [data.album_id]);
  }
  // INSERT OR IGNORE: a duplicate import_hash inserts nothing, and lastInsertId
  // then points at an unrelated earlier row — return the existing media instead.
  if (result.rowsAffected === 0 && data.import_hash) {
    const existing = await query<Media>("SELECT * FROM media WHERE import_hash = ?", [
      data.import_hash,
    ]);
    return existing[0]!;
  }
  return (await getMedia(result.lastInsertId))!;
}

export async function updateMedia(
  id: number,
  data: { title?: string | null; caption?: string | null; album_id?: number | null; is_favorite?: boolean }
): Promise<Media> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getMedia(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => (f === "is_favorite" ? (data[f] ? 1 : 0) : data[f]));
  await execute(
    `UPDATE media SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getMedia(id))!;
}

export const deleteMedia = (id: number) => galleryData.deleteMedia(appRunner, id);

export async function checkMediaExists(importHash: string): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM media WHERE import_hash = ?",
    [importHash]
  );
  return rows.length > 0;
}
