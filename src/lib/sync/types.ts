import type { LinkTable } from "../data/links";
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

/** A family relationship as pulled from the web, addressed by web member ids. */
export interface RemoteRelationship {
  from_remote_id: string;
  to_remote_id: string;
  type: "parent" | "child" | "sibling" | "spouse" | "partner" | "other";
}

/** One owner's links in a join table, expressed with web ids (the shape the push API expects). */
export interface LinkSetPayload {
  table: LinkTable;
  owner: "a" | "b";
  owner_remote_id: string;
  other_remote_ids: string[];
  known_other_remote_ids: string[];
}

/** One family member's relationships, relative to that member, with web ids. */
export interface RelationshipSetPayload {
  member_remote_id: string;
  relationships: Array<{ other_remote_id: string; type: "parent" | "child" | "sibling" | "spouse"; direction: "from" | "to" }>;
  known_remote_ids: string[];
}

/** A local record with changes the web does not have yet. */
export interface UnpublishedItem {
  entity_type: EntityType;
  local_id: number;
  /** "new": never published. "changed": published before and edited since. */
  kind: "new" | "changed";
  label: string;
  /** Something the user should know before publishing this item. */
  warning?: string;
}

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
    source_url: string | null;
    remote_url: string | null;
  }): Promise<number>;
  /** Repair an existing media row's album link + size + remote_url without re-downloading or bumping updated_at. */
  relinkMedia(
    localId: number,
    album_id: number | null,
    file_size: number | null,
    remote_url: string | null
  ): Promise<void>;

  /**
   * The complete payload for publishing one local record: syncable and push-enabled columns plus
   * its category (name/color/icon) and tag names. Falls back to getLocal(...).fields when absent.
   */
  getPushFields?(type: EntityType, localId: number): Promise<Record<string, unknown> | null>;
  /** Local ids on the other side of a link table for one owner row. */
  getLinkedLocalIds?(table: LinkTable, ownerCol: string, ownerId: number): Promise<number[]>;
  /** Every local family relationship (from/to member ids). */
  listFamilyRelationships?(): Promise<Array<{ from_member_id: number; to_member_id: number; relationship_type: string }>>;
  /** Assign (or clear, with null) the category of a local row, creating the category when new. */
  setCategory?(type: EntityType, localId: number, cat: { name: string; color: string | null; icon: string | null } | null): Promise<void>;
  /** Replace a local row's tags with exactly these names. */
  setTags?(type: EntityType, localId: number, names: string[]): Promise<void>;
  /** Replace one owner's rows in a link table. */
  replaceLinks?(table: LinkTable, ownerCol: string, ownerId: number, otherIds: number[]): Promise<void>;
  /** Add family relationships (local ids) that are missing; never removes ones created in the app. */
  mergeFamilyRelationships?(
    rels: Array<{ from_member_id: number; to_member_id: number; relationship_type: string }>
  ): Promise<void>;

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
  /** Push link sets and family relationship sets (web ids). Returns any problems the web reported. */
  pushRelations?(payload: { links?: LinkSetPayload[]; family_relationships?: RelationshipSetPayload[] }): Promise<{ conflicts: string[] }>;
  /** Download one media file to local storage; returns the local file path. */
  downloadMedia(remote: RemoteRecord): Promise<string>;
  /** Download a web image (story cover, photo, logo…) to local storage; returns the local file path. */
  downloadImage?(url: string): Promise<string>;
  /** Family relationships from the most recent pullAll, if the web supplied any. */
  getFamilyRelationships?(): RemoteRelationship[];
}
