import { query, execute } from "../db";
import { appRunner } from "../data/sql";
import { getLinkedIds, replaceLinks, type LinkTable } from "../data/links";
import { listRelationships, mergeRelationships } from "../data/family";
import { getTagNames, setCategoryByName, setTags, type CategorizedTable, type TaggedTable } from "../data/taxonomy";
import { entityDef, pushableColumns, writableColumns, type EntityType } from "./registry";
import type { DataStore, LocalMedia, LocalRecord, SyncState } from "./types";

function toLocalRecord(def: ReturnType<typeof entityDef>, row: Record<string, unknown>): LocalRecord {
  const fields: Record<string, unknown> = {};
  for (const c of def.columns) fields[c] = row[c] ?? null;
  return {
    local_id: row.id as number,
    updated_at: (row.updated_at as string) ?? "",
    fields,
  };
}

export class SqlDataStore implements DataStore {
  async listLocal(type: EntityType): Promise<LocalRecord[]> {
    const def = entityDef(type);
    const rows = await query<Record<string, unknown>>(`SELECT * FROM ${def.table}`);
    return rows.map((r) => toLocalRecord(def, r));
  }

  async getLocal(type: EntityType, localId: number): Promise<LocalRecord | null> {
    const def = entityDef(type);
    const rows = await query<Record<string, unknown>>(`SELECT * FROM ${def.table} WHERE id = ?`, [localId]);
    return rows[0] ? toLocalRecord(def, rows[0]) : null;
  }

  async upsertLocal(type: EntityType, fields: Record<string, unknown>): Promise<number> {
    const def = entityDef(type);
    const cols = writableColumns(def).filter((c) => def.columns.includes(c) || c in fields);
    const values = cols.map((c) => fields[c] ?? null);

    if (def.singleton) {
      const set = cols.map((c) => `${c} = ?`).join(", ");
      await execute(
        `UPDATE ${def.table} SET ${set}, updated_at = datetime('now') WHERE id = 1`,
        values
      );
      return 1;
    }

    const placeholders = cols.map(() => "?").join(", ");
    const res = await execute(
      `INSERT INTO ${def.table} (${cols.join(", ")}, created_at, updated_at)
       VALUES (${placeholders}, datetime('now'), datetime('now'))`,
      values
    );
    return res.lastInsertId;
  }

  async updateLocalById(type: EntityType, localId: number, fields: Record<string, unknown>): Promise<void> {
    const def = entityDef(type);
    // Core columns always overwrite; web-owned extras only when the web supplied them,
    // so an older web API (without the new fields) never blanks local data.
    const cols = writableColumns(def).filter((c) => def.columns.includes(c) || c in fields);
    const set = cols.map((c) => `${c} = ?`).join(", ");
    const values = cols.map((c) => fields[c] ?? null);
    await execute(
      `UPDATE ${def.table} SET ${set}, updated_at = datetime('now') WHERE id = ?`,
      [...values, localId]
    );
  }

  async deleteLocal(type: EntityType, localId: number): Promise<void> {
    const def = entityDef(type);
    await execute(`DELETE FROM ${def.table} WHERE id = ?`, [localId]);
  }

  async insertSyncedMedia(row: {
    file_path: string;
    thumbnail_path: string;
    filename: string;
    caption: string | null;
    file_size: number | null;
    mime_type: string;
    album_id: number | null;
    source_url: string | null;
    remote_url: string | null;
  }): Promise<number> {
    const res = await execute(
      `INSERT INTO media
         (file_path, thumbnail_path, filename, caption, file_size, mime_type, album_id, source_url, remote_url, import_source, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,'sync',datetime('now'),datetime('now'))`,
      [row.file_path, row.thumbnail_path, row.filename, row.caption, row.file_size, row.mime_type, row.album_id, row.source_url, row.remote_url]
    );
    return res.lastInsertId;
  }

  async relinkMedia(
    localId: number,
    album_id: number | null,
    file_size: number | null,
    remote_url: string | null
  ): Promise<void> {
    // Intentionally does NOT bump updated_at — media is never locally edited.
    await execute(
      `UPDATE media SET album_id = ?, file_size = COALESCE(?, file_size), remote_url = COALESCE(?, remote_url) WHERE id = ?`,
      [album_id, file_size, remote_url, localId]
    );
  }

  async listAlbumMedia(albumLocalId: number): Promise<{ media: LocalMedia[]; coverMediaId: number | null }> {
    const media = await query<LocalMedia>(
      `SELECT id, file_path, thumbnail_path, filename, caption, source_url, mime_type, remote_url
         FROM media WHERE album_id = ? ORDER BY sort_order, id`,
      [albumLocalId]
    );
    const album = await query<{ cover_media_id: number | null }>("SELECT cover_media_id FROM albums WHERE id = ?", [albumLocalId]);
    return { media, coverMediaId: album[0]?.cover_media_id ?? null };
  }

  async recordMediaUploaded(mediaLocalId: number, remoteId: string, webUrl: string, updatedAt: string): Promise<void> {
    // remote_url is what the web's cover address is matched against, so keep it in step with the upload.
    await execute("UPDATE media SET remote_url = ? WHERE id = ?", [webUrl, mediaLocalId]);
    await this.putSyncState({ entity_type: "media", local_id: mediaLocalId, remote_id: remoteId, last_synced_at: updatedAt, last_synced_remote_at: updatedAt });
  }

  async getLinkedLocalIds(table: LinkTable, ownerCol: string, ownerId: number): Promise<number[]> {
    return getLinkedIds(appRunner, table, ownerCol, ownerId);
  }

  async listFamilyRelationships(): Promise<Array<{ from_member_id: number; to_member_id: number; relationship_type: string }>> {
    return listRelationships(appRunner);
  }

  async getPushFields(type: EntityType, localId: number): Promise<Record<string, unknown> | null> {
    const def = entityDef(type);
    const rows = await query<Record<string, unknown>>(`SELECT * FROM ${def.table} WHERE id = ?`, [localId]);
    const row = rows[0];
    if (!row) return null;
    const fields: Record<string, unknown> = {};
    for (const c of pushableColumns(def)) fields[c] = row[c] ?? null;
    // Image fields carry the local file path here; publishing uploads it and swaps in the web address.
    for (const img of def.images ?? []) fields[img.remoteField] = row[img.pathColumn] ?? null;
    if (def.categorized) {
      const cat = await query<{ name: string; color: string | null; icon: string | null }>(
        `SELECT c.name, c.color, c.icon FROM categories c JOIN ${def.table} t ON t.category_id = c.id WHERE t.id = ?`,
        [localId]
      );
      fields.category = cat[0]?.name ?? null;
      fields.category_color = cat[0]?.color ?? null;
      fields.category_icon = cat[0]?.icon ?? null;
    }
    if (def.tagged) fields.tags = await getTagNames(appRunner, def.table as TaggedTable, localId);
    return fields;
  }

  async setCategory(
    type: EntityType,
    localId: number,
    cat: { name: string; color: string | null; icon: string | null } | null
  ): Promise<void> {
    await setCategoryByName(appRunner, entityDef(type).table as CategorizedTable, localId, cat);
  }

  async setTags(type: EntityType, localId: number, names: string[]): Promise<void> {
    await setTags(appRunner, entityDef(type).table as TaggedTable, localId, names);
  }

  async replaceLinks(table: LinkTable, ownerCol: string, ownerId: number, otherIds: number[]): Promise<void> {
    await replaceLinks(appRunner, table, ownerCol, ownerId, otherIds);
  }

  async mergeFamilyRelationships(
    rels: Array<{ from_member_id: number; to_member_id: number; relationship_type: string }>
  ): Promise<void> {
    await mergeRelationships(appRunner, rels);
  }

  async listSyncState(type: EntityType): Promise<SyncState[]> {
    return query<SyncState>(`SELECT * FROM sync_state WHERE entity_type = ?`, [type]);
  }

  async getSyncState(type: EntityType, localId: number): Promise<SyncState | null> {
    const rows = await query<SyncState>(
      `SELECT * FROM sync_state WHERE entity_type = ? AND local_id = ?`,
      [type, localId]
    );
    return rows[0] ?? null;
  }

  async getSyncStateByRemote(type: EntityType, remoteId: string): Promise<SyncState | null> {
    const rows = await query<SyncState>(
      `SELECT * FROM sync_state WHERE entity_type = ? AND remote_id = ?`,
      [type, remoteId]
    );
    return rows[0] ?? null;
  }

  async putSyncState(s: SyncState): Promise<void> {
    await execute(
      `INSERT INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(entity_type, local_id) DO UPDATE SET
         remote_id = excluded.remote_id,
         last_synced_at = excluded.last_synced_at,
         last_synced_remote_at = excluded.last_synced_remote_at`,
      [s.entity_type, s.local_id, s.remote_id, s.last_synced_at, s.last_synced_remote_at]
    );
  }

  async deleteSyncStateRow(type: EntityType, localId: number): Promise<void> {
    await execute(`DELETE FROM sync_state WHERE entity_type = ? AND local_id = ?`, [type, localId]);
  }
}
