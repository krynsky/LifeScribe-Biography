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

/**
 * The web-side URL an album's explicit coverImage is matched against.
 * The web stores coverImage as a media's url OR thumbnailUrl, so for videos
 * (whose url is a non-image embed) we match on the thumbnail instead.
 */
function matchableUrl(fields: Record<string, unknown>): string | null {
  if (fields.media_type === "video") return (fields.thumbnail_url as string | null) ?? null;
  return (fields.url as string | null) ?? null;
}

/** Read a dotted path ("related.albums") from pulled fields. */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => (cur && typeof cur === "object" ? (cur as Record<string, unknown>)[key] : undefined), obj);
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
    this.pendingRelations = [];

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

    // Categories, tags and links are applied once every record exists locally, so remote ids
    // can be resolved to local ids regardless of the order entities were pulled in.
    for (const p of this.pendingRelations) {
      try {
        await this.applyRelations(p.type, p.localId, p.fields);
      } catch (e) {
        summary.errors.push(`${p.type}:${p.localId} relations: ${(e as Error).message}`);
      }
    }
    this.pendingRelations = [];

    if (this.mode === "web-master") {
      try {
        await this.syncFamilyRelationships();
      } catch (e) {
        summary.errors.push(`family_relationships: ${(e as Error).message}`);
      }
    }
    return summary;
  }

  private pendingRelations: Array<{ type: EntityType; localId: number; fields: Record<string, unknown> }> = [];

  /** Map a pulled record's category, tags and linked-record refs onto the local relational tables. */
  private async applyRelations(type: EntityType, localId: number, fields: Record<string, unknown>): Promise<void> {
    const def = entityDef(type);
    if (def.categorized && "category" in fields && this.store.setCategory) {
      const name = fields.category as string | null;
      await this.store.setCategory(
        type,
        localId,
        name ? { name, color: (fields.category_color as string | null) ?? null, icon: (fields.category_icon as string | null) ?? null } : null
      );
    }
    if (def.tagged && Array.isArray(fields.tags) && this.store.setTags) {
      await this.store.setTags(type, localId, (fields.tags as unknown[]).filter((t): t is string => typeof t === "string"));
    }
    for (const spec of def.links ?? []) {
      const refs = getPath(fields, spec.field);
      if (!Array.isArray(refs) || !this.store.replaceLinks) continue;
      const otherIds: number[] = [];
      for (const ref of refs as Array<{ remote_id?: string }>) {
        if (!ref?.remote_id) continue;
        const st = await this.store.getSyncStateByRemote(spec.otherType, ref.remote_id);
        if (st) otherIds.push(st.local_id);
      }
      await this.store.replaceLinks(spec.table, spec.ownerCol, localId, otherIds);
    }
  }

  /** Add the web's family relationships (mapped onto local member ids) that are missing locally. Never deletes. */
  private async syncFamilyRelationships(): Promise<void> {
    const remote = this.adapter.getFamilyRelationships?.();
    if (!remote || !this.store.mergeFamilyRelationships) return;
    const idByRemote = new Map<string, number>();
    for (const st of await this.store.listSyncState("family_member")) {
      if (st.remote_id) idByRemote.set(st.remote_id, st.local_id);
    }
    const rows = [];
    for (const r of remote) {
      const from = idByRemote.get(r.from_remote_id);
      const to = idByRemote.get(r.to_remote_id);
      if (from != null && to != null) {
        rows.push({ from_member_id: from, to_member_id: to, relationship_type: r.type });
      }
    }
    await this.store.mergeFamilyRelationships(rows);
  }

  /**
   * Download any web images referenced by this record and return fields with the
   * local file path columns filled in. A failed download never fails the record.
   */
  private async withDownloadedImages(
    def: ReturnType<typeof entityDef>,
    remote: RemoteRecord,
    summary: RefreshSummary,
    onProgress?: (msg: string) => void
  ): Promise<Record<string, unknown>> {
    const fields = { ...remote.fields };
    for (const img of def.images ?? []) {
      if (!(img.remoteField in remote.fields)) continue; // older web API: leave local image alone
      const url = remote.fields[img.remoteField] as string | null;
      if (!url) {
        fields[img.pathColumn] = null;
      } else if (this.adapter.downloadImage) {
        try {
          onProgress?.(`Downloading image for ${def.type}…`);
          fields[img.pathColumn] = await this.adapter.downloadImage(url);
        } catch (e) {
          summary.errors.push(`${def.type}:${remote.remote_id} image: ${(e as Error).message}`);
        }
      }
    }
    return fields;
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
          const isVideo = remote.fields.media_type === "video";
          const localId = await this.store.insertSyncedMedia({
            file_path: path,
            thumbnail_path: path,
            filename: (remote.fields.filename as string) ?? "file",
            caption: (remote.fields.caption as string | null) ?? null,
            file_size: (remote.fields.size_bytes as number | null) ?? null,
            mime_type: mimeForMedia(remote.fields),
            album_id: albumId,
            source_url: isVideo ? ((remote.fields.url as string | null) ?? null) : null,
            remote_url: matchableUrl(remote.fields),
          });
          await this.link(type, localId, remote);
        } else {
          const fields = await this.withDownloadedImages(def, remote, summary, onProgress);
          const localId = await this.store.upsertLocal(type, fields);
          await this.link(type, localId, remote);
          this.pendingRelations.push({ type, localId, fields: remote.fields });
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
              (remote.fields.size_bytes as number | null) ?? null,
              matchableUrl(remote.fields)
            );
            await this.link(type, existing.local_id, remote);
            summary.updated++;
          }
        } else if (existing) {
          const fields = await this.withDownloadedImages(def, remote, summary, onProgress);
          await this.store.updateLocalById(type, existing.local_id, fields);
          await this.link(type, existing.local_id, remote);
          this.pendingRelations.push({ type, localId: existing.local_id, fields: remote.fields });
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
