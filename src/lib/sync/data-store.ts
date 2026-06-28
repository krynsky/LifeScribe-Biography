import { query, execute } from "../db";
import { entityDef, type EntityType } from "./registry";
import type { DataStore, LocalRecord, SyncState } from "./types";

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
    const cols = def.columns;
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
    const set = def.columns.map((c) => `${c} = ?`).join(", ");
    const values = def.columns.map((c) => fields[c] ?? null);
    await execute(
      `UPDATE ${def.table} SET ${set}, updated_at = datetime('now') WHERE id = ?`,
      [...values, localId]
    );
  }

  async deleteLocal(type: EntityType, localId: number): Promise<void> {
    const def = entityDef(type);
    await execute(`DELETE FROM ${def.table} WHERE id = ?`, [localId]);
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
