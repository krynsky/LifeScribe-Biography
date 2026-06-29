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
          const localId = await this.store.upsertLocal(type, {
            ...remote.fields,
            file_path: path,
            thumbnail_path: path,
            mime_type: "image/jpeg",
            import_source: "sync",
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
        if (!def.binary && existing) {
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
