import { ENTITIES, entityDef, type EntityType } from "./registry";
import { decide } from "./reconcile";
import type { DataStore, RemoteRecord, SyncMode, SyncState, WebAdapter } from "./types";

export interface ConflictItem {
  entity_type: EntityType;
  local_id: number;
  remote_id: string;
}

export interface RefreshSummary {
  created: number;
  updated: number;
  deleted: number;
  conflicts: ConflictItem[];
  errors: string[];
}

const nowIso = () => new Date().toISOString();

/** Derive a mime type for a downloaded media file from its web metadata. */
function mimeForMedia(fields: Record<string, unknown>): string {
  if (fields.media_type === "video") return "video/mp4";
  const filename = (fields.filename as string) ?? "";
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase();
  return `image/${ext === "jpg" ? "jpeg" : ext}`;
}

export class SyncService {
  constructor(
    private store: DataStore,
    private adapter: WebAdapter,
    private mode: SyncMode
  ) {}

  async refresh(onProgress?: (msg: string) => void): Promise<RefreshSummary> {
    const summary: RefreshSummary = { created: 0, updated: 0, deleted: 0, conflicts: [], errors: [] };
    if (this.mode === "standalone") return summary;

    onProgress?.("Fetching web content…");
    const remoteByType = await this.adapter.pullAll();

    for (const def of ENTITIES) {
      const remotes = remoteByType[def.type] ?? [];
      const states = await this.store.listSyncState(def.type);
      const seenRemoteIds = new Set<string>();

      for (const remote of remotes) {
        seenRemoteIds.add(remote.remote_id);
        try {
          await this.applyRemote(def.type, remote, summary, onProgress);
        } catch (e) {
          summary.errors.push(`${def.type}:${remote.remote_id}: ${(e as Error).message}`);
        }
      }

      for (const st of states) {
        if (st.remote_id && !seenRemoteIds.has(st.remote_id)) {
          const local = await this.store.getLocal(def.type, st.local_id);
          const d = decide({
            mode: this.mode,
            localUpdatedAt: local?.updated_at ?? null,
            state: st,
            remoteUpdatedAt: null,
          });
          if (d.action === "delete_local") {
            await this.store.deleteLocal(def.type, st.local_id);
            await this.store.deleteSyncStateRow(def.type, st.local_id);
            summary.deleted++;
          }
        }
      }
    }
    return summary;
  }

  async publish(
    items: Array<{ entity_type: EntityType; local_id: number }>,
    onProgress?: (msg: string) => void
  ): Promise<{ published: number; errors: string[] }> {
    const result = { published: 0, errors: [] as string[] };
    if (this.mode === "standalone") return result;

    const byType = new Map<EntityType, number[]>();
    for (const it of items) {
      byType.set(it.entity_type, [...(byType.get(it.entity_type) ?? []), it.local_id]);
    }

    for (const [type, localIds] of byType) {
      if (entityDef(type).binary) continue; // media is downloaded, not JSON-published
      onProgress?.(`Publishing ${type}…`);
      const records = [];
      for (const localId of localIds) {
        const local = await this.store.getLocal(type, localId);
        const st = await this.store.getSyncState(type, localId);
        if (!local) continue;
        records.push({
          local_id: localId,
          remote_id: st?.remote_id ?? null,
          last_synced_remote_at: st?.last_synced_remote_at ?? null,
          fields: local.fields,
        });
      }
      if (records.length === 0) continue;
      try {
        const { remoteIdMap, remoteUpdatedAt } = await this.adapter.push(type, records);
        for (const rec of records) {
          const remoteId = remoteIdMap[rec.local_id];
          if (!remoteId) {
            result.errors.push(`${type}:${rec.local_id} not published (web changed — refresh to resolve)`);
            continue;
          }
          const local = await this.store.getLocal(type, rec.local_id);
          await this.store.putSyncState({
            entity_type: type,
            local_id: rec.local_id,
            remote_id: remoteId,
            last_synced_at: local?.updated_at ?? nowIso(),
            last_synced_remote_at: remoteUpdatedAt[rec.local_id] ?? nowIso(),
          });
          result.published++;
        }
      } catch (e) {
        result.errors.push(`${type}: ${(e as Error).message}`);
      }
    }
    return result;
  }

  private async applyRemote(
    type: EntityType,
    remote: RemoteRecord,
    summary: RefreshSummary,
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const def = entityDef(type);
    const existing = await this.store.getSyncStateByRemote(type, remote.remote_id);
    const local = existing ? await this.store.getLocal(type, existing.local_id) : null;

    const d = decide({
      mode: this.mode,
      localUpdatedAt: local?.updated_at ?? null,
      state: existing,
      remoteUpdatedAt: remote.remote_updated_at || nowIso(),
    });

    switch (d.action) {
      case "create_local": {
        if (def.binary) {
          onProgress?.(`Downloading ${remote.fields.filename ?? "media"}…`);
          const path = await this.adapter.downloadMedia(remote);
          const albumId = await this.resolveAlbumId(remote.fields.album_remote_id as string | null);
          const localId = await this.store.insertSyncedMedia({
            file_path: path,
            thumbnail_path: path,
            filename: (remote.fields.filename as string) ?? "file",
            caption: (remote.fields.caption as string | null) ?? null,
            file_size: (remote.fields.size_bytes as number | null) ?? null,
            mime_type: mimeForMedia(remote.fields),
            album_id: albumId,
          });
          await this.link(type, localId, remote);
        } else {
          const localId = await this.store.upsertLocal(type, remote.fields);
          await this.link(type, localId, remote);
        }
        summary.created++;
        break;
      }
      case "take_web": {
        if (def.binary) {
          // Don't re-download an existing file; just repair its album link + size.
          if (existing) {
            const albumId = await this.resolveAlbumId(remote.fields.album_remote_id as string | null);
            await this.store.relinkMedia(
              existing.local_id,
              albumId,
              (remote.fields.size_bytes as number | null) ?? null
            );
            await this.link(type, existing.local_id, remote);
            summary.updated++;
          }
        } else if (existing) {
          await this.store.updateLocalById(type, existing.local_id, remote.fields);
          await this.link(type, existing.local_id, remote);
          summary.updated++;
        }
        break;
      }
      case "conflict": {
        if (existing) summary.conflicts.push({ entity_type: type, local_id: existing.local_id, remote_id: remote.remote_id });
        break;
      }
    }
  }

  /** Resolve a web album CUID to its local album id via the album's sync_state. */
  private async resolveAlbumId(albumRemoteId: string | null | undefined): Promise<number | null> {
    if (!albumRemoteId) return null;
    const st = await this.store.getSyncStateByRemote("album", albumRemoteId);
    return st?.local_id ?? null;
  }

  /** Records with local edits not yet published (dirty + linked). */
  async listUnpublished(): Promise<Array<{ entity_type: EntityType; local_id: number }>> {
    const out: Array<{ entity_type: EntityType; local_id: number }> = [];
    for (const def of ENTITIES) {
      const states = await this.store.listSyncState(def.type);
      for (const st of states) {
        if (!st.remote_id || !st.last_synced_at) continue;
        const local = await this.store.getLocal(def.type, st.local_id);
        if (local && local.updated_at > st.last_synced_at) {
          out.push({ entity_type: def.type, local_id: st.local_id });
        }
      }
    }
    return out;
  }

  /**
   * Recovery: force every linked local record to be re-pulled fresh by clearing
   * last_synced_* (so decide() sees web as changed and local as clean), then refresh().
   */
  async reset(onProgress?: (msg: string) => void): Promise<RefreshSummary> {
    for (const def of ENTITIES) {
      const states = await this.store.listSyncState(def.type);
      for (const st of states) {
        await this.store.putSyncState({ ...st, last_synced_remote_at: null, last_synced_at: null });
      }
    }
    return this.refresh(onProgress);
  }

  private async link(type: EntityType, localId: number, remote: RemoteRecord): Promise<void> {
    const local = await this.store.getLocal(type, localId);
    const st: SyncState = {
      entity_type: type,
      local_id: localId,
      remote_id: remote.remote_id,
      last_synced_at: local?.updated_at ?? nowIso(),
      last_synced_remote_at: remote.remote_updated_at || nowIso(),
    };
    await this.store.putSyncState(st);
  }
}
