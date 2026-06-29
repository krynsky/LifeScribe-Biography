import type { EntityType } from "./registry";

export type SyncMode = "web-master" | "app-master" | "standalone";

/** Sync-owned bookkeeping for one local entity row. */
export interface SyncState {
  entity_type: EntityType;
  local_id: number;
  remote_id: string | null;
  last_synced_at: string | null; // local updated_at at last reconcile
  last_synced_remote_at: string | null; // web updatedAt at last reconcile
}

/** A local entity row reduced to what sync cares about. */
export interface LocalRecord {
  local_id: number;
  updated_at: string;
  /** Syncable column values, keyed by column name. */
  fields: Record<string, unknown>;
}

/** A remote entity as returned by /sync/pull (already local-shaped snake_case). */
export interface RemoteRecord {
  remote_id: string;
  remote_updated_at: string;
  fields: Record<string, unknown>;
}

/** The decision the pure reconciler returns for a single record. */
export type Decision =
  | { action: "take_web" } // overwrite local with web
  | { action: "create_local" } // web record has no local counterpart
  | { action: "keep_local_unpublished" } // local edit not yet published; do nothing on refresh
  | { action: "conflict" } // both sides changed since last sync
  | { action: "delete_local" } // present locally, deleted on master
  | { action: "noop" };

export interface DataStore {
  listLocal(type: EntityType): Promise<LocalRecord[]>;
  getLocal(type: EntityType, localId: number): Promise<LocalRecord | null>;
  /** Insert or update a local row from web fields; returns local id. For singletons, updates id=1. */
  upsertLocal(type: EntityType, fields: Record<string, unknown>): Promise<number>;
  updateLocalById(type: EntityType, localId: number, fields: Record<string, unknown>): Promise<void>;
  deleteLocal(type: EntityType, localId: number): Promise<void>;

  /** Insert a downloaded media row (binary entity; needs file_path which is NOT NULL). Returns local id. */
  insertSyncedMedia(row: {
    file_path: string;
    thumbnail_path: string;
    filename: string;
    caption: string | null;
    file_size: number | null;
    mime_type: string;
    album_id: number | null;
  }): Promise<number>;
  /** Repair an existing media row's album link + size without re-downloading or bumping updated_at. */
  relinkMedia(localId: number, album_id: number | null, file_size: number | null): Promise<void>;

  listSyncState(type: EntityType): Promise<SyncState[]>;
  getSyncState(type: EntityType, localId: number): Promise<SyncState | null>;
  getSyncStateByRemote(type: EntityType, remoteId: string): Promise<SyncState | null>;
  putSyncState(s: SyncState): Promise<void>;
  deleteSyncStateRow(type: EntityType, localId: number): Promise<void>;
}

export interface WebAdapter {
  /** Full pull of all entities; returns records grouped by type. */
  pullAll(): Promise<Record<EntityType, RemoteRecord[]>>;
  /** Push selected local records of one type; returns local_id -> remote_id for newly linked rows. */
  push(type: EntityType, records: Array<{ local_id: number; remote_id: string | null; last_synced_remote_at: string | null; fields: Record<string, unknown> }>): Promise<{
    remoteIdMap: Record<number, string>;
    remoteUpdatedAt: Record<number, string>;
    conflicts: string[];
  }>;
  deleteRemote(type: EntityType, remoteId: string): Promise<void>;
  /** Download one media file to local storage; returns the local file path. */
  downloadMedia(remote: RemoteRecord): Promise<string>;
}
