import { query, execute } from "../db";
import type { Album, Media } from "../models";
import { CATEGORY_SELECT, categoryJoin, tagsSelect } from "../data/select";

// Albums

export async function listAlbums(): Promise<(Album & { media_count: number; cover_path: string | null })[]> {
  // 1) Albums with their media counts (simple, no correlated subquery).
  const albums = await query<Album & { media_count: number }>(
    `SELECT a.*, ${CATEGORY_SELECT}, ${tagsSelect("album", "a")}, COUNT(m.id) as media_count
       FROM albums a
       ${categoryJoin("a")}
       LEFT JOIN media m ON m.album_id = a.id
       GROUP BY a.id
       ORDER BY COALESCE(a.position, 1000000), a.created_at DESC`
  );

  // 2) Resolve each album's cover with a plain parameterized query. This avoids
  // a correlated subquery referencing a.cover_image, which the app's SQLite
  // (sqlx) rejects. Prefer the explicit cover (remote_url == cover_image),
  // else the first photo.
  const result: (Album & { media_count: number; cover_path: string | null })[] = [];
  for (const a of albums) {
    const coverImage = (a as { cover_image?: string | null }).cover_image ?? null;
    let cover: { thumbnail_path: string }[] = [];
    try {
      cover = await query<{ thumbnail_path: string }>(
        `SELECT thumbnail_path FROM media
           WHERE album_id = ? AND thumbnail_path IS NOT NULL
           ORDER BY CASE WHEN ? IS NOT NULL AND remote_url = ? THEN 0 ELSE 1 END, sort_order, id
           LIMIT 1`,
        [a.id, coverImage, coverImage]
      );
    } catch {
      // remote_url column may not exist (pre-migration) — fall back to first photo.
      cover = await query<{ thumbnail_path: string }>(
        `SELECT thumbnail_path FROM media
           WHERE album_id = ? AND thumbnail_path IS NOT NULL
           ORDER BY sort_order, id LIMIT 1`,
        [a.id]
      );
    }
    result.push({ ...a, cover_path: cover[0]?.thumbnail_path ?? null });
  }
  return result;
}

export async function getAlbum(id: number): Promise<Album | null> {
  const rows = await query<Album>(
    `SELECT a.*, ${CATEGORY_SELECT}, ${tagsSelect("album", "a")} FROM albums a ${categoryJoin("a")} WHERE a.id = ?`,
    [id]
  );
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
  data: { title?: string; caption?: string; album_id?: number | null; is_favorite?: boolean }
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
