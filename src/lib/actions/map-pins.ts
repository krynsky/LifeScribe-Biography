import { query, execute } from "../db";
import type { MapPin } from "../models";
import { CATEGORY_SELECT, categoryJoin } from "../data/select";
import { appRunner } from "../data/sql";
import { deleteEntityLinks } from "../data/entity-links";

export async function listMapPins(): Promise<MapPin[]> {
  return query<MapPin>(
    `SELECT p.*, ${CATEGORY_SELECT} FROM map_pins p ${categoryJoin("p")} ORDER BY COALESCE(p.position, 1000000), COALESCE(p.visit_date, p.created_at) DESC`
  );
}

export async function getMapPin(id: number): Promise<MapPin | null> {
  const rows = await query<MapPin>(
    `SELECT p.*, ${CATEGORY_SELECT} FROM map_pins p ${categoryJoin("p")} WHERE p.id = ?`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createMapPin(data: {
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  address?: string | null;
  visit_date?: string | null;
  pin_type?: MapPin["pin_type"];
  color?: string;
  image_path?: string | null;
  category_id?: number | null;
}): Promise<MapPin> {
  const result = await execute(
    `INSERT INTO map_pins (name, description, latitude, longitude, address, visit_date, pin_type, color, image_path, category_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.description ?? null,
      data.latitude,
      data.longitude,
      data.address ?? null,
      data.visit_date ?? null,
      data.pin_type ?? "place",
      data.color ?? "#3D7A8A",
      data.image_path ?? null,
      data.category_id ?? null,
    ]
  );
  return (await getMapPin(result.lastInsertId))!;
}

export async function updateMapPin(
  id: number,
  data: Partial<Parameters<typeof createMapPin>[0]>
): Promise<MapPin> {
  const fields = Object.keys(data) as (keyof typeof data)[];
  if (fields.length === 0) return (await getMapPin(id))!;
  const setClauses = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f]);
  await execute(
    `UPDATE map_pins SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`,
    [...values, id]
  );
  return (await getMapPin(id))!;
}

export async function deleteMapPin(id: number): Promise<void> {
  await deleteEntityLinks(appRunner, "map_pin", id);
  await execute("DELETE FROM map_pins WHERE id = ?", [id]);
}

export async function getMediaForPin(pinId: number): Promise<{ media_id: number }[]> {
  return query<{ media_id: number }>(
    "SELECT media_id FROM media_map_pins WHERE map_pin_id = ?",
    [pinId]
  );
}

export async function linkMediaToPin(mediaId: number, pinId: number): Promise<void> {
  await execute(
    "INSERT OR IGNORE INTO media_map_pins (media_id, map_pin_id) VALUES (?, ?)",
    [mediaId, pinId]
  );
}

export async function unlinkMediaFromPin(mediaId: number, pinId: number): Promise<void> {
  await execute(
    "DELETE FROM media_map_pins WHERE media_id = ? AND map_pin_id = ?",
    [mediaId, pinId]
  );
}
