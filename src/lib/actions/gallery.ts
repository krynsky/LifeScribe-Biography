import { query, execute } from "../db";
import type { Album, Media } from "../models";

// Albums

export async function listAlbums(): Promise<(Album & { media_count: number; cover_path: string | null })[]> {
  // Migration 0004 adds albums.cover_image + media.remote_url. If it hasn't run
  // yet (e.g. the app was hot-reloaded rather than restarted), fall back to a
  // query that doesn't reference those columns so the gallery still renders.
  const albumCols = await query<{ name: string }>("PRAGMA table_info(albums)");
  const hasCoverCols = albumCols.some((c) => c.name === "cover_image");

  if (hasCoverCols) {
    return query<Album & { media_count: number; cover_path: string | null }>(
      `SELECT a.*, COUNT(m.id) as media_count,
         (SELECT c.thumbnail_path FROM media c
            WHERE c.album_id = a.id AND c.thumbnail_path IS NOT NULL
            ORDER BY
              CASE WHEN a.cover_image IS NOT NULL AND c.remote_url = a.cover_image THEN 0 ELSE 1 END,
              c.sort_order, c.id
            LIMIT 1) as cover_path
       FROM albums a
       LEFT JOIN media m ON m.album_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC`
    );
  }

  return query<Album & { media_count: number; cover_path: string | null }>(
    `SELECT a.*, NULL as cover_image, COUNT(m.id) as media_count,
       (SELECT c.thumbnail_path FROM media c
          WHERE c.album_id = a.id AND c.thumbnail_path IS NOT NULL
          ORDER BY c.sort_order, c.id
          LIMIT 1) as cover_path
     FROM albums a
     LEFT JOIN media m ON m.album_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`
  );
}

export async function getAlbum(id: number): Promise<Album | null> {
  const rows = await query<Album>("SELECT * FROM albums WHERE id = ?", [id]);
  return rows[0] ?? null;
}

export async function createAlbum(data: {
  name: string;
  description?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Album> {
  const result = await execute(
    "INSERT INTO albums (name, description, date_from, date_to) VALUES (?, ?, ?, ?)",
    [data.name, data.description ?? null, data.date_from ?? null, data.date_to ?? null]
  );
  return (await getAlbum(result.lastInsertId))!;
}

export async function updateAlbum(
  id: number,
  data: { name?: string; description?: string; cover_media_id?: number | null }
): Promise<Album> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getAlbum(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);
  await execute(
    `UPDATE albums SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getAlbum(id))!;
}

export async function deleteAlbum(id: number): Promise<void> {
  await execute("DELETE FROM albums WHERE id = ?", [id]);
}

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
}): Promise<Media> {
  const result = await execute(
    `INSERT OR IGNORE INTO media
      (file_path, thumbnail_path, filename, title, caption, width, height,
       file_size, mime_type, taken_at, camera_make, camera_model,
       latitude, longitude, album_id, import_source, import_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return (await getMedia(result.lastInsertId))!;
}

export async function updateMedia(
  id: number,
  data: { title?: string; caption?: string; album_id?: number | null; is_favorite?: boolean }
): Promise<Media> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getMedia(id))!;
  const setClauses = fields.map((f) => (f === "is_favorite" ? `${f} = ?` : `${f} = ?`)).join(", ");
  const values = fields.map((f) => (f === "is_favorite" ? (data[f] ? 1 : 0) : data[f]));
  await execute(
    `UPDATE media SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getMedia(id))!;
}

export async function deleteMedia(id: number): Promise<void> {
  await execute("DELETE FROM media WHERE id = ?", [id]);
}

export async function checkMediaExists(importHash: string): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM media WHERE import_hash = ?",
    [importHash]
  );
  return rows.length > 0;
}
