import { ENTITIES, PUSH_LINKS, entityDef, entityLabel, type EntityType } from "./registry";
import { decide } from "./reconcile";
import { LOCAL_IMAGES_NOTE, hasLocalImages, isWebDownloadedImage } from "./local-images";
import { rewriteLocalImages } from "./story-images";
import type { DataStore, LinkSetPayload, LocalMedia, PendingDeletion, RelationshipSetPayload, RemoteRecord, SyncMode, SyncState, UnpublishedItem, WebAdapter } from "./types";

export interface ConflictItem {
  entity_type: EntityType;
  local_id: number;
  remote_id: string;
  /** The website's version, kept so the user can compare and choose. */
  remote?: RemoteRecord;
}

export interface RefreshSummary {
  created: number;
  updated: number;
  deleted: number;
  conflicts: ConflictItem[];
  errors: string[];
  /** Website records skipped because they were deleted in the app and are waiting for a decision. */
  keptDeleted: number;
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
    const summary: RefreshSummary = { created: 0, updated: 0, deleted: 0, conflicts: [], errors: [], keptDeleted: 0 };
    if (this.mode === "standalone") return summary;
    this.pendingRelations = [];

    onProgress?.("Fetching web content…");
    const remoteByType = await this.adapter.pullAll();
    // Records you deleted in the app stay deleted until you decide what to do with them on the website.
    const deletedInApp = new Set(((await this.store.listTombstones?.()) ?? []).map((t) => t.remote_id));

    for (const def of ENTITIES) {
      const remotes = remoteByType[def.type] ?? [];
      const states = await this.store.listSyncState(def.type);
      const seenRemoteIds = new Set<string>();

      for (const remote of remotes) {
        seenRemoteIds.add(remote.remote_id);
        if (deletedInApp.has(remote.remote_id)) {
          summary.keptDeleted++;
          continue;
        }
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

    await this.applyPendingRelations(summary.errors);

    if (this.mode === "web-master") {
      try {
        await this.syncFamilyRelationships();
      } catch (e) {
        summary.errors.push(`family_relationships: ${(e as Error).message}`);
      }
    }
    return summary;
  }

  /** Apply the categories, tags and links collected while records were pulled (every record exists locally by now). */
  private async applyPendingRelations(errors: string[]): Promise<void> {
    for (const p of this.pendingRelations) {
      try {
        await this.applyRelations(p.type, p.localId, p.fields);
      } catch (e) {
        errors.push(`${p.type}:${p.localId} relations: ${(e as Error).message}`);
      }
    }
    this.pendingRelations = [];
  }

  /** Things deleted in the app that are still on the website. */
  async listDeletions(): Promise<PendingDeletion[]> {
    return (await this.store.listTombstones?.()) ?? [];
  }

  /**
   * Remove the chosen records from the website. A record that fails stays on the list so you can
   * try again; one that is already gone from the website counts as done.
   */
  async publishDeletions(ids: number[], onProgress?: (msg: string) => void): Promise<{ removed: number; errors: string[] }> {
    const result = { removed: 0, errors: [] as string[] };
    if (this.mode === "standalone") return result;
    const chosen = (await this.listDeletions()).filter((d) => ids.includes(d.id));
    for (const d of chosen) {
      try {
        onProgress?.(`Removing “${d.label}” from the website…`);
        await this.adapter.deleteRemote(d.entity_type, d.remote_id);
        await this.store.removeTombstone?.(d.remote_id);
        result.removed++;
      } catch (e) {
        result.errors.push(`${d.label}: ${(e as Error).message}`);
      }
    }
    return result;
  }

  /** Stop treating a record as deleted: the next Refresh brings the website's copy back into the app. */
  async restoreDeleted(remoteId: string): Promise<void> {
    await this.store.removeTombstone?.(remoteId);
  }

  /**
   * Settle a record edited on both sides. "web" replaces your version with the website's; "mine"
   * accepts that the website changed and publishes your version over it.
   */
  async resolveConflict(c: ConflictItem, choice: "mine" | "web", onProgress?: (msg: string) => void): Promise<{ ok: boolean; error?: string }> {
    if (this.mode === "standalone") return { ok: false, error: "Sync is turned off." };
    const st = await this.store.getSyncState(c.entity_type, c.local_id);
    if (!st || !c.remote) return { ok: false, error: "Refresh from web again to compare the two versions." };

    if (choice === "web") {
      const local = await this.store.getLocal(c.entity_type, c.local_id);
      // Make your copy look unedited and the website's look newer, so the normal path takes the website's version.
      await this.store.putSyncState({ ...st, last_synced_at: local?.updated_at ?? nowIso(), last_synced_remote_at: null });
      const summary: RefreshSummary = { created: 0, updated: 0, deleted: 0, conflicts: [], errors: [], keptDeleted: 0 };
      this.pendingRelations = [];
      try {
        await this.applyRemote(c.entity_type, c.remote, summary, onProgress);
        await this.applyPendingRelations(summary.errors);
      } catch (e) {
        await this.store.putSyncState(st); // put the bookkeeping back so nothing is lost
        return { ok: false, error: (e as Error).message };
      }
      return summary.errors.length ? { ok: false, error: summary.errors.join("; ") } : { ok: true };
    }

    await this.store.putSyncState({ ...st, last_synced_remote_at: c.remote.remote_updated_at });
    const res = await this.publish([{ entity_type: c.entity_type, local_id: c.local_id }], onProgress);
    if (res.errors.length > 0 || res.published === 0) {
      await this.store.putSyncState(st); // still in conflict
      return { ok: false, error: res.errors.join("; ") || "The website did not accept the change." };
    }
    return { ok: true };
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
  ): Promise<{ published: number; errors: string[]; photos: number }> {
    const result = { published: 0, errors: [] as string[], photos: 0 };
    if (this.mode === "standalone") return result;
    const publishedRecords: Array<{ type: EntityType; localId: number; remoteId: string }> = [];

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
        // Full payload (extra columns, category, tags) when the store can build it.
        const fields = (await this.store.getPushFields?.(type, localId)) ?? local.fields;
        await this.preparePhotos(type, localId, fields, result, onProgress);
        records.push({
          local_id: localId,
          remote_id: st?.remote_id ?? null,
          last_synced_remote_at: st?.last_synced_remote_at ?? null,
          fields,
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
          publishedRecords.push({ type, localId: rec.local_id, remoteId });
        }
      } catch (e) {
        result.errors.push(`${type}: ${(e as Error).message}`);
      }
    }
    // Album photos and covers need the albums to exist on the web first.
    const albums = publishedRecords.filter((p) => p.type === "album");
    if (albums.length > 0) {
      try {
        await this.publishAlbumMedia(albums, result, onProgress);
      } catch (e) {
        result.errors.push(`photos: ${(e as Error).message}`);
      }
    }

    // Links and family relationships go last, once every published record has a web id.
    if (publishedRecords.length > 0) {
      try {
        await this.pushRelations(publishedRecords, result, onProgress);
      } catch (e) {
        result.errors.push(`links: ${(e as Error).message}`);
      }
    }
    return result;
  }

  /**
   * Turn local photo paths in a record's payload into website addresses by uploading them. A photo
   * that fails to upload is left out (the record still publishes) and reported. Photos that are
   * unchanged copies of what the site already has are not sent again, and an empty photo never
   * clears the one on the site.
   */
  private async preparePhotos(
    type: EntityType,
    localId: number,
    fields: Record<string, unknown>,
    result: { errors: string[]; photos: number },
    onProgress?: (msg: string) => void
  ): Promise<void> {
    const upload = this.adapter.uploadImageFile?.bind(this.adapter);
    for (const img of entityDef(type).images ?? []) {
      const value = fields[img.remoteField];
      if (typeof value === "string" && upload && !/^https?:/i.test(value) && !isWebDownloadedImage(value)) {
        try {
          onProgress?.("Uploading photos…");
          fields[img.remoteField] = await upload(value);
          result.photos++;
          continue;
        } catch (e) {
          result.errors.push(`${type}:${localId} photo: ${(e as Error).message}`);
        }
      }
      if (typeof value === "string" && /^https:\/\//i.test(value)) continue; // already a website address
      delete fields[img.remoteField];
    }

    if (type === "story" && upload && typeof fields.content === "string") {
      const rewritten = await rewriteLocalImages(fields.content, async (path) => {
        onProgress?.("Uploading photos…");
        const url = await upload(path);
        result.photos++;
        return url;
      });
      fields.content = rewritten.content;
      for (const f of rewritten.failed) result.errors.push(`${type}:${localId} photo in text: ${f.error}`);
    }
  }

  /** Upload the photos and linked videos of albums that were just published, then set each album cover. */
  private async publishAlbumMedia(
    albums: Array<{ type: EntityType; localId: number; remoteId: string }>,
    result: { published: number; errors: string[]; photos: number },
    onProgress?: (msg: string) => void
  ): Promise<void> {
    if (!this.store.listAlbumMedia || !this.store.recordMediaUploaded) return;
    const coversToSet: Array<{ album: (typeof albums)[number]; url: string }> = [];

    for (const album of albums) {
      const { media, coverMediaId } = await this.store.listAlbumMedia(album.localId);
      let coverUrl: string | null = null;
      for (const m of media) {
        const done = await this.store.getSyncState("media", m.id);
        let webUrl = done?.remote_id ? m.remote_url : null;
        if (!done?.remote_id) {
          try {
            onProgress?.(`Uploading photos (${media.indexOf(m) + 1} of ${media.length})…`);
            const uploaded = await this.uploadOneMedia(m, album.remoteId);
            if (!uploaded) continue;
            await this.store.recordMediaUploaded(m.id, uploaded.mediaId, uploaded.url, nowIso());
            webUrl = uploaded.url;
            result.photos++;
          } catch (e) {
            result.errors.push(`media:${m.id} ${m.filename}: ${(e as Error).message}`);
            continue;
          }
        }
        if (m.id === coverMediaId && webUrl) coverUrl = webUrl;
      }
      if (coverUrl) coversToSet.push({ album, url: coverUrl });
    }

    // The cover is a property of the album, so it is sent as a second small update.
    for (const { album, url } of coversToSet) {
      const st = await this.store.getSyncState("album", album.localId);
      const fields = (await this.store.getPushFields?.("album", album.localId)) ?? (await this.store.getLocal("album", album.localId))?.fields;
      if (!fields) continue;
      const { remoteUpdatedAt, remoteIdMap } = await this.adapter.push("album", [
        { local_id: album.localId, remote_id: album.remoteId, last_synced_remote_at: st?.last_synced_remote_at ?? null, fields: { ...fields, cover_image: url } },
      ]);
      if (remoteIdMap[album.localId] && st) {
        await this.store.putSyncState({ ...st, last_synced_remote_at: remoteUpdatedAt[album.localId] ?? st.last_synced_remote_at });
      }
    }
  }

  /** Upload one gallery item (local photo, image link or video link) to an album. Null when there is nothing to upload. */
  private async uploadOneMedia(m: LocalMedia, albumRemoteId: string): Promise<{ mediaId: string; url: string } | null> {
    if (m.source_url) {
      if (!this.adapter.addMediaLink) return null;
      const thumb = m.remote_url ?? (/^https:/i.test(m.thumbnail_path ?? "") ? m.thumbnail_path : null);
      return this.adapter.addMediaLink({ url: m.source_url, thumbnailUrl: thumb, type: "video", filename: m.filename, albumRemoteId, caption: m.caption });
    }
    if (/^https:\/\//i.test(m.file_path)) {
      if (!this.adapter.addMediaLink) return null;
      return this.adapter.addMediaLink({ url: m.file_path, thumbnailUrl: m.file_path, type: "image", filename: m.filename, albumRemoteId, caption: m.caption });
    }
    if (!this.adapter.uploadMediaFile) return null;
    return this.adapter.uploadMediaFile(m.file_path, { albumRemoteId, filename: m.filename, caption: m.caption });
  }

  /**
   * Send the links (and family relationships) of the records just published. Only targets that have a
   * web id can be linked; others are skipped and will link the next time they are published.
   */
  private async pushRelations(
    published: Array<{ type: EntityType; localId: number; remoteId: string }>,
    result: { published: number; errors: string[] },
    onProgress?: (msg: string) => void
  ): Promise<void> {
    if (!this.adapter.pushRelations) return;
    const links: LinkSetPayload[] = [];
    const relationshipSets: RelationshipSetPayload[] = [];

    const remoteIds = new Map<EntityType, Map<number, string>>();
    const remoteIdOf = async (type: EntityType, localId: number) => {
      if (!remoteIds.has(type)) {
        const map = new Map<number, string>();
        for (const st of await this.store.listSyncState(type)) if (st.remote_id) map.set(st.local_id, st.remote_id);
        remoteIds.set(type, map);
      }
      return remoteIds.get(type)!.get(localId);
    };
    const knownRemoteIds = async (type: EntityType) => {
      await remoteIdOf(type, -1);
      return [...remoteIds.get(type)!.values()];
    };

    for (const rec of published) {
      for (const spec of PUSH_LINKS[rec.type] ?? []) {
        if (!this.store.getLinkedLocalIds) continue;
        const localOthers = await this.store.getLinkedLocalIds(spec.table, spec.ownerCol, rec.localId);
        const others: string[] = [];
        for (const id of localOthers) {
          const rid = await remoteIdOf(spec.otherType, id);
          if (rid) others.push(rid);
        }
        links.push({
          table: spec.table,
          owner: spec.owner,
          owner_remote_id: rec.remoteId,
          other_remote_ids: others,
          known_other_remote_ids: await knownRemoteIds(spec.otherType),
        });
      }
    }

    if (this.store.listFamilyRelationships) {
      const all = await this.store.listFamilyRelationships();
      const known = await knownRemoteIds("family_member");
      for (const rec of published.filter((p) => p.type === "family_member")) {
        const relationships: RelationshipSetPayload["relationships"] = [];
        for (const r of all) {
          const type = r.relationship_type;
          if (type !== "parent" && type !== "child" && type !== "sibling" && type !== "spouse") continue;
          const fromThis = r.from_member_id === rec.localId;
          if (!fromThis && r.to_member_id !== rec.localId) continue;
          const rid = await remoteIdOf("family_member", fromThis ? r.to_member_id : r.from_member_id);
          if (rid) relationships.push({ other_remote_id: rid, type, direction: fromThis ? "from" : "to" });
        }
        relationshipSets.push({ member_remote_id: rec.remoteId, relationships, known_remote_ids: known });
      }
    }

    if (links.length === 0 && relationshipSets.length === 0) return;
    onProgress?.("Publishing links and relationships…");
    const { conflicts } = await this.adapter.pushRelations({
      ...(links.length ? { links } : {}),
      ...(relationshipSets.length ? { family_relationships: relationshipSets } : {}),
    });
    for (const c of conflicts) result.errors.push(`links: ${c}`);
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
        if (existing) summary.conflicts.push({ entity_type: type, local_id: existing.local_id, remote_id: remote.remote_id, remote });
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

  /**
   * Local records the web does not have yet: **new** ones that were never published and **changed**
   * ones edited since they were last synced. The profile is only ever "changed" (never created), so
   * connecting a fresh app cannot overwrite the website's title with a default.
   */
  async listUnpublished(): Promise<UnpublishedItem[]> {
    const out: UnpublishedItem[] = [];
    if (this.mode === "standalone") return out;
    for (const def of ENTITIES) {
      if (def.binary) continue;
      const states = new Map((await this.store.listSyncState(def.type)).map((st) => [st.local_id, st]));
      for (const local of await this.store.listLocal(def.type)) {
        const st = states.get(local.local_id);
        const label = entityLabel(def.type, local.fields);
        const warning = def.type === "story" && hasLocalImages(local.fields.content) ? LOCAL_IMAGES_NOTE : undefined;
        const base = { entity_type: def.type, local_id: local.local_id, label, ...(warning ? { warning } : {}) };
        if (!st || !st.remote_id) {
          if (!def.singleton) out.push({ ...base, kind: "new" });
        } else if (st.last_synced_at && local.updated_at > st.last_synced_at) {
          out.push({ ...base, kind: "changed" });
        }
      }
    }
    return out;
  }

  /**
   * Recovery: force every linked local record to be re-pulled fresh by clearing
   * last_synced_* (so decide() sees web as changed and local as clean), then refresh().
   * Records with unpublished local edits are skipped.
   */
  async reset(onProgress?: (msg: string) => void): Promise<RefreshSummary> {
    for (const def of ENTITIES) {
      const states = await this.store.listSyncState(def.type);
      for (const st of states) {
        // Keep records with unpublished local edits as they are, so a reset can never discard your work.
        const local = await this.store.getLocal(def.type, st.local_id);
        const dirty = !!local && !!st.last_synced_at && local.updated_at > st.last_synced_at;
        if (dirty) continue;
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
