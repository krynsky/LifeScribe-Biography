import { describe, it, expect } from "vitest";
import { SyncService } from "./sync-service";
import type { DataStore, WebAdapter, LocalRecord, SyncState, RemoteRecord, PendingDeletion } from "./types";
import type { EntityType } from "./registry";

class FakeStore implements DataStore {
  local: Record<string, LocalRecord[]> = {};
  state: Record<string, SyncState[]> = {};
  nextId = 100;
  mergeFamilyRelationships?: DataStore["mergeFamilyRelationships"];
  setCategory?: DataStore["setCategory"];
  getPushFields?: DataStore["getPushFields"];
  getLinkedLocalIds?: DataStore["getLinkedLocalIds"];
  listFamilyRelationships?: DataStore["listFamilyRelationships"];
  listAlbumMedia?: DataStore["listAlbumMedia"];
  listTombstones?: DataStore["listTombstones"];
  removeTombstone?: DataStore["removeTombstone"];
  recordMediaUploaded?: DataStore["recordMediaUploaded"];
  setTags?: DataStore["setTags"];
  replaceLinks?: DataStore["replaceLinks"];
  async listLocal(t: EntityType) { return this.local[t] ?? []; }
  async getLocal(t: EntityType, id: number) { return (this.local[t] ?? []).find((r) => r.local_id === id) ?? null; }
  async upsertLocal(t: EntityType, fields: Record<string, unknown>) {
    const id = this.nextId++;
    (this.local[t] ??= []).push({ local_id: id, updated_at: "2026-01-01T00:00:00.000Z", fields });
    return id;
  }
  async updateLocalById(t: EntityType, id: number, fields: Record<string, unknown>) {
    const r = (this.local[t] ?? []).find((x) => x.local_id === id);
    if (r) r.fields = fields;
  }
  async deleteLocal(t: EntityType, id: number) { this.local[t] = (this.local[t] ?? []).filter((r) => r.local_id !== id); }
  async insertSyncedMedia(row: { file_path: string; thumbnail_path: string; filename: string; caption: string | null; file_size: number | null; mime_type: string; album_id: number | null; source_url: string | null; remote_url: string | null }) {
    const id = this.nextId++;
    (this.local.media ??= []).push({ local_id: id, updated_at: "2026-01-01T00:00:00.000Z", fields: { ...row } });
    return id;
  }
  async relinkMedia(localId: number, album_id: number | null, file_size: number | null, remote_url: string | null) {
    const r = (this.local.media ?? []).find((x) => x.local_id === localId);
    if (r) { r.fields.album_id = album_id; if (file_size != null) r.fields.file_size = file_size; if (remote_url != null) r.fields.remote_url = remote_url; }
  }
  async listSyncState(t: EntityType) { return this.state[t] ?? []; }
  async getSyncState(t: EntityType, id: number) { return (this.state[t] ?? []).find((s) => s.local_id === id) ?? null; }
  async getSyncStateByRemote(t: EntityType, rid: string) { return (this.state[t] ?? []).find((s) => s.remote_id === rid) ?? null; }
  async putSyncState(s: SyncState) {
    const arr = (this.state[s.entity_type] ??= []);
    const i = arr.findIndex((x) => x.local_id === s.local_id);
    if (i >= 0) arr[i] = s; else arr.push(s);
  }
  async deleteSyncStateRow(t: EntityType, id: number) { this.state[t] = (this.state[t] ?? []).filter((s) => s.local_id !== id); }
}

class FakeAdapter implements WebAdapter {
  writeCalls = 0;
  getFamilyRelationships?: WebAdapter["getFamilyRelationships"];
  downloadImage?: WebAdapter["downloadImage"];
  pushRelations?: WebAdapter["pushRelations"];
  uploadImageFile?: WebAdapter["uploadImageFile"];
  uploadMediaFile?: WebAdapter["uploadMediaFile"];
  addMediaLink?: WebAdapter["addMediaLink"];
  constructor(public remote: Partial<Record<EntityType, RemoteRecord[]>> = {}) {}
  async pullAll() {
    const out: Record<EntityType, RemoteRecord[]> = {
      biography: [], story: [], milestone: [], career: [],
      map_pin: [], family_member: [], album: [], media: [],
    };
    return { ...out, ...this.remote } as Record<EntityType, RemoteRecord[]>;
  }
  async push(_t: EntityType, records: Array<{ local_id: number; remote_id: string | null; last_synced_remote_at: string | null; fields: Record<string, unknown> }>) {
    this.writeCalls++;
    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    for (const r of records) { remoteIdMap[r.local_id] = r.remote_id ?? `new-${r.local_id}`; remoteUpdatedAt[r.local_id] = "2026-01-03T00:00:00.000Z"; }
    return { remoteIdMap, remoteUpdatedAt, conflicts: [] as string[] };
  }
  async deleteRemote(_type: EntityType = "story", _remoteId: string = "") { this.writeCalls++; }
  async downloadMedia() { return "/local/x.jpg"; }
}

describe("SyncService.refresh — incident regression", () => {
  it("web-master refresh performs ZERO web writes", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "local edit" } }];
    store.state.story = [{ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "web" } }],
    });
    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();
    expect(adapter.writeCalls).toBe(0);
    expect(summary.conflicts.length).toBe(1);
  });

  it("web-master refresh takes web for a non-dirty changed record", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "old" } }];
    store.state.story = [{ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "new from web" } }],
    });
    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();
    expect(adapter.writeCalls).toBe(0);
    expect(summary.updated).toBe(1);
  });

  it("creates a new local record for a web-only item", async () => {
    const store = new FakeStore();
    const adapter = new FakeAdapter({
      story: [{ remote_id: "r9", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "brand new" } }],
    });
    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();
    expect(summary.created).toBe(1);
    expect((store.local.story ?? []).length).toBe(1);
    expect((store.state.story ?? []).length).toBe(1);
  });
});

describe("SyncService.publish", () => {
  it("pushes only the selected items and advances sync_state", async () => {
    const store = new FakeStore();
    store.local.story = [
      { local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "edited A" } },
      { local_id: 2, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "edited B" } },
    ];
    store.state.story = [
      { entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" },
      { entity_type: "story", local_id: 2, remote_id: "r2", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" },
    ];
    const adapter = new FakeAdapter();
    const svc = new SyncService(store, adapter, "web-master");

    await svc.publish([{ entity_type: "story", local_id: 1 }]);

    expect(adapter.writeCalls).toBe(1);
    const s1 = await store.getSyncState("story", 1);
    expect(s1!.last_synced_at).toBe("2026-01-03T00:00:00.000Z");
    const s2 = await store.getSyncState("story", 2);
    expect(s2!.last_synced_at).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("SyncService.listUnpublished", () => {
  it("returns only locally-edited linked records", async () => {
    const store = new FakeStore();
    store.local.story = [
      { local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "dirty" } },
      { local_id: 2, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "clean" } },
    ];
    store.state.story = [
      { entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" },
      { entity_type: "story", local_id: 2, remote_id: "r2", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" },
    ];
    const svc = new SyncService(store, new FakeAdapter(), "web-master");
    const list = await svc.listUnpublished();
    expect(list).toEqual([{ entity_type: "story", local_id: 1, kind: "changed", label: "dirty" }]);
  });

  it("also lists records that were never published, labelled for review", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "Brand new" } }];
    store.local.career = [{ local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "Dev", organization: "Org" } }];
    store.local.family_member = [{ local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { given_name: "Jane", surname: "Doe" } }];
    const list = await new SyncService(store, new FakeAdapter(), "web-master").listUnpublished();
    expect(list).toEqual([
      { entity_type: "story", local_id: 1, kind: "new", label: "Brand new" },
      { entity_type: "career", local_id: 1, kind: "new", label: "Dev @ Org" },
      { entity_type: "family_member", local_id: 1, kind: "new", label: "Jane Doe" },
    ]);
  });

  it("never offers to create the profile (it is only ever updated)", async () => {
    const store = new FakeStore();
    store.local.biography = [{ local_id: 1, updated_at: "2026-01-05T00:00:00.000Z", fields: { title: "My Life Story" } }];
    const svc = new SyncService(store, new FakeAdapter(), "web-master");
    expect(await svc.listUnpublished()).toEqual([]); // never synced: no baseline, no create
    store.state.biography = [{ entity_type: "biography", local_id: 1, remote_id: "site", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    expect(await svc.listUnpublished()).toEqual([{ entity_type: "biography", local_id: 1, kind: "changed", label: "My Life Story" }]);
  });

  it("lists nothing in standalone mode", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "x" } }];
    expect(await new SyncService(store, new FakeAdapter(), "standalone").listUnpublished()).toEqual([]);
  });
});

describe("SyncService.publish — rejection handling", () => {
  it("does NOT advance sync_state when the web rejects the push (stale)", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "edited" } }];
    store.state.story = [{ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter();
    adapter.push = async () => ({ remoteIdMap: {}, remoteUpdatedAt: {}, conflicts: ["stories:1:stale"] });
    const svc = new SyncService(store, adapter, "web-master");
    const res = await svc.publish([{ entity_type: "story", local_id: 1 }]);
    expect(res.published).toBe(0);
    expect(res.errors.length).toBe(1);
    const s1 = await store.getSyncState("story", 1);
    expect(s1!.last_synced_at).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("SyncService.refresh — media album linkage", () => {
  it("create_local resolves album_remote_id to the local album id", async () => {
    const store = new FakeStore();
    // Album already exists locally and is linked (localid 7 <-> web "alb-r1").
    store.local.album = [{ local_id: 7, updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Trip" } }];
    store.state.album = [{ entity_type: "album", local_id: 7, remote_id: "alb-r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({
      // Album must be in the pull too, else refresh's delete-reconciliation removes it.
      album: [{ remote_id: "alb-r1", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Trip" } }],
      media: [{ remote_id: "m1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { filename: "p.jpg", caption: null, album_remote_id: "alb-r1", size_bytes: 123, media_type: "image" } }],
    });
    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();
    expect(summary.created).toBe(1);
    expect(store.local.media!.length).toBe(1);
    expect(store.local.media![0].fields.album_id).toBe(7); // resolved, not null
    expect(store.local.media![0].fields.file_path).toBe("/local/x.jpg");
    expect(store.local.media![0].fields.file_size).toBe(123); // size_bytes -> file_size
  });

  it("take_web relinks an existing media row WITHOUT re-downloading", async () => {
    const store = new FakeStore();
    store.local.album = [{ local_id: 7, updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Trip" } }];
    store.state.album = [{ entity_type: "album", local_id: 7, remote_id: "alb-r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    // Existing media row with NO album link, baseline cleared (as after a reset).
    store.local.media = [{ local_id: 50, updated_at: "2026-01-01T00:00:00.000Z", fields: { filename: "p.jpg", album_id: null } }];
    store.state.media = [{ entity_type: "media", local_id: 50, remote_id: "m1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: null }];
    const adapter = new FakeAdapter({
      album: [{ remote_id: "alb-r1", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Trip" } }],
      media: [{ remote_id: "m1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { filename: "p.jpg", album_remote_id: "alb-r1", size_bytes: 99, media_type: "image" } }],
    });
    let downloads = 0;
    adapter.downloadMedia = async () => { downloads++; return "/local/x.jpg"; };
    const svc = new SyncService(store, adapter, "web-master");
    await svc.refresh();
    expect(downloads).toBe(0); // no re-download
    expect(store.local.media![0].fields.album_id).toBe(7); // relinked
  });

  it("stores source_url for video media (YouTube)", async () => {
    const store = new FakeStore();
    store.local.album = [{ local_id: 7, updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Adventures" } }];
    store.state.album = [{ entity_type: "album", local_id: 7, remote_id: "alb-r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({
      album: [{ remote_id: "alb-r1", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { name: "Adventures" } }],
      media: [{ remote_id: "v1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { filename: "YouTube - abc", album_remote_id: "alb-r1", size_bytes: null, media_type: "video", url: "https://www.youtube.com/embed/abc", thumbnail_url: "https://img.youtube.com/vi/abc/hqdefault.jpg" } }],
    });
    const svc = new SyncService(store, adapter, "web-master");
    await svc.refresh();
    expect(store.local.media!.length).toBe(1);
    expect(store.local.media![0].fields.source_url).toBe("https://www.youtube.com/embed/abc");
    expect(store.local.media![0].fields.album_id).toBe(7);
  });
});

describe("SyncService.refresh — web parity fields", () => {
  class ImageAdapter extends FakeAdapter {
    downloaded: string[] = [];
    constructor(remote: ConstructorParameters<typeof FakeAdapter>[0]) {
      super(remote);
      this.downloadImage = async (url: string) => { this.downloaded.push(url); return `/local/${url.split("/").pop()}`; };
    }
  }

  it("downloads a story's cover image and stores the local path", async () => {
    const store = new FakeStore();
    const adapter = new ImageAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "T", featured_image_url: "https://files.x/cover.jpg" } }],
    });
    await new SyncService(store, adapter, "web-master").refresh();
    expect(adapter.downloaded).toEqual(["https://files.x/cover.jpg"]);
    expect(store.local.story[0].fields.featured_image_path).toBe("/local/cover.jpg");
  });

  it("leaves local images alone when the web API sends no image field", async () => {
    const store = new FakeStore();
    const adapter = new ImageAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "T" } }],
    });
    await new SyncService(store, adapter, "web-master").refresh();
    expect(adapter.downloaded).toEqual([]);
    expect("featured_image_path" in store.local.story[0].fields).toBe(false);
  });

  it("a failed image download is reported but still creates the record", async () => {
    const store = new FakeStore();
    const adapter = new ImageAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "T", featured_image_url: "https://files.x/c.jpg" } }],
    });
    adapter.downloadImage = async () => { throw new Error("404"); };
    const summary = await new SyncService(store, adapter, "web-master").refresh();
    expect(summary.created).toBe(1);
    expect(summary.errors.length).toBe(1);
  });

  it("adds the web family relationships onto local member ids", async () => {
    const store = new FakeStore();
    let saved: unknown[] = [];
    store.mergeFamilyRelationships = async (rels) => { saved = rels; };
    const adapter = new ImageAdapter({
      family_member: [
        { remote_id: "a", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { given_name: "A" } },
        { remote_id: "b", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { given_name: "B" } },
      ],
    });
    adapter.getFamilyRelationships = () => [
      { from_remote_id: "a", to_remote_id: "b", type: "parent" },
      { from_remote_id: "a", to_remote_id: "missing", type: "spouse" },
    ];
    await new SyncService(store, adapter, "web-master").refresh();
    expect(saved).toEqual([{ from_member_id: 100, to_member_id: 101, relationship_type: "parent" }]);
  });
});

describe("SyncService.refresh — categories, tags and links", () => {
  it("applies category, tags and resolved links after every record exists", async () => {
    const store = new FakeStore();
    const cats: unknown[] = [];
    const tags: unknown[] = [];
    const links: unknown[] = [];
    store.setCategory = async (t, id, cat) => { cats.push([t, id, cat]); };
    store.setTags = async (t, id, names) => { tags.push([t, id, names]); };
    store.replaceLinks = async (table, ownerCol, ownerId, otherIds) => { links.push([table, ownerCol, ownerId, otherIds]); };
    const adapter = new FakeAdapter({
      // milestone listed first: its linked story is created later in the same refresh
      milestone: [{ remote_id: "m1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "M", category: "Travel", category_color: "#f00", category_icon: null, linked_stories: [{ remote_id: "s1" }, { remote_id: "gone" }] } }],
      story: [{ remote_id: "s1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "S", category: null, tags: ["a", "b"], related: { albums: [{ remote_id: "a1" }] } } }],
      album: [{ remote_id: "a1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { name: "A", category: "Fam", tags: [] } }],
    });
    const summary = await new SyncService(store, adapter, "web-master").refresh();
    expect(summary.errors).toEqual([]);
    const milestoneId = store.local.milestone[0].local_id;
    const storyId = store.local.story[0].local_id;
    const albumId = store.local.album[0].local_id;
    expect(cats).toContainEqual(["milestone", milestoneId, { name: "Travel", color: "#f00", icon: null }]);
    expect(cats).toContainEqual(["story", storyId, null]);
    expect(tags).toContainEqual(["story", storyId, ["a", "b"]]);
    expect(links).toContainEqual(["story_milestones", "milestone_id", milestoneId, [storyId]]); // "gone" skipped
    expect(links).toContainEqual(["story_albums", "story_id", storyId, [albumId]]);
  });

  it("does not touch relations for a record kept as an unpublished local edit", async () => {
    const store = new FakeStore();
    let called = 0;
    store.setCategory = async () => { called++; };
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "local" } }];
    store.state.story = [{ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({ story: [{ remote_id: "r1", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "web", category: "X" } }] });
    await new SyncService(store, adapter, "web-master").refresh();
    expect(called).toBe(0);
  });
});

describe("SyncService.publish — new records and full payload", () => {
  it("creates a new record on the web, links it, and sends the store's full payload", async () => {
    const store = new FakeStore();
    store.local.milestone = [{ local_id: 7, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "Core only" } }];
    store.getPushFields = async () => ({ title: "Core only", end_date: "2020-05-01", category: "Travel", category_color: "#0EA5E9", category_icon: null });
    const adapter = new FakeAdapter();
    let sent: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }> = [];
    adapter.push = async (_t, records) => {
      sent = records;
      return { remoteIdMap: { 7: "new-remote" }, remoteUpdatedAt: { 7: "2026-02-01T00:00:00.000Z" }, conflicts: [] };
    };
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "milestone", local_id: 7 }]);
    expect(res).toEqual({ published: 1, errors: [], photos: 0 });
    expect(sent[0].remote_id).toBeNull();
    expect(sent[0].fields).toMatchObject({ end_date: "2020-05-01", category: "Travel" });
    const st = await store.getSyncState("milestone", 7);
    expect(st).toMatchObject({ remote_id: "new-remote", last_synced_remote_at: "2026-02-01T00:00:00.000Z", last_synced_at: "2026-01-03T00:00:00.000Z" });
    // once published it is no longer "new"
    expect(await new SyncService(store, adapter, "web-master").listUnpublished()).toEqual([]);
  });

  it("a new record the web rejects stays unpublished and is reported", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "T" } }];
    const adapter = new FakeAdapter();
    adapter.push = async () => ({ remoteIdMap: {}, remoteUpdatedAt: {}, conflicts: ["stories:1:invalid_content"] });
    const svc = new SyncService(store, adapter, "web-master");
    const res = await svc.publish([{ entity_type: "story", local_id: 1 }]);
    expect(res.published).toBe(0);
    expect(res.errors).toHaveLength(1);
    expect(await store.getSyncState("story", 1)).toBeNull();
    expect((await svc.listUnpublished()).map((i) => i.kind)).toEqual(["new"]);
  });
});

describe("SyncService.listUnpublished — local photo warning", () => {
  it("notes that story bodies with photos from this computer will be uploaded", async () => {
    const store = new FakeStore();
    const withLocal = JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "http://asset.localhost/C%3A/a.jpg" } }] });
    store.local.story = [
      { local_id: 1, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "Has local photo", content: withLocal } },
      { local_id: 2, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "Plain", content: "{}" } },
    ];
    const list = await new SyncService(store, new FakeAdapter(), "web-master").listUnpublished();
    expect(list.find((i) => i.local_id === 1)?.warning).toMatch(/will be uploaded/);
    expect(list.find((i) => i.local_id === 2)?.warning).toBeUndefined();
  });
});

describe("SyncService.reset", () => {
  it("leaves records with unpublished local edits untouched", async () => {
    const store = new FakeStore();
    store.local.story = [
      { local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "my edit" } },
      { local_id: 2, updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "clean" } },
    ];
    const synced = (id: number, rid: string): SyncState => ({ entity_type: "story", local_id: id, remote_id: rid, last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" });
    store.state.story = [synced(1, "r1"), synced(2, "r2")];
    const adapter = new FakeAdapter({
      story: [
        { remote_id: "r1", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "web 1" } },
        { remote_id: "r2", remote_updated_at: "2026-01-01T00:00:00.000Z", fields: { title: "web 2" } },
      ],
    });
    await new SyncService(store, adapter, "web-master").reset();
    expect(store.local.story.find((r) => r.local_id === 1)!.fields.title).toBe("my edit"); // kept
    expect(store.local.story.find((r) => r.local_id === 2)!.fields.title).toBe("web 2"); // re-pulled
  });
});

describe("SyncService.publish — links and family relationships", () => {
  const synced = (type: EntityType, id: number, rid: string): SyncState => ({
    entity_type: type, local_id: id, remote_id: rid,
    last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z",
  });

  it("sends a published story's links using web ids, skipping targets the web does not have", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "S" } }];
    store.state.story = [synced("story", 1, "story-r")];
    store.state.milestone = [synced("milestone", 10, "ms-r10"), synced("milestone", 11, "ms-r11")];
    // local milestone 12 was never published, so it has no web id yet
    store.getLinkedLocalIds = async (table, ownerCol, ownerId) =>
      table === "story_milestones" && ownerCol === "story_id" && ownerId === 1 ? [10, 12] : [];
    const adapter = new FakeAdapter();
    let sent: Parameters<NonNullable<WebAdapter["pushRelations"]>>[0] | undefined;
    adapter.pushRelations = async (payload) => { sent = payload; return { conflicts: [] }; };

    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);

    expect(res.errors).toEqual([]);
    const ms = sent!.links!.find((l) => l.table === "story_milestones")!;
    expect(ms).toMatchObject({ owner: "a", owner_remote_id: "story-r", other_remote_ids: ["ms-r10"] });
    expect(ms.known_other_remote_ids.sort()).toEqual(["ms-r10", "ms-r11"]); // web-only milestones stay untouched
  });

  it("uses the owner side for a milestone's story and album links", async () => {
    const store = new FakeStore();
    store.local.milestone = [{ local_id: 5, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "M" } }];
    store.state.milestone = [synced("milestone", 5, "ms-r5")];
    store.state.story = [synced("story", 1, "story-r1")];
    store.getLinkedLocalIds = async (table) => (table === "story_milestones" ? [1] : []);
    const adapter = new FakeAdapter();
    let sent: Parameters<NonNullable<WebAdapter["pushRelations"]>>[0] | undefined;
    adapter.pushRelations = async (payload) => { sent = payload; return { conflicts: [] }; };

    await new SyncService(store, adapter, "web-master").publish([{ entity_type: "milestone", local_id: 5 }]);

    expect(sent!.links).toContainEqual({ table: "story_milestones", owner: "b", owner_remote_id: "ms-r5", other_remote_ids: ["story-r1"], known_other_remote_ids: ["story-r1"] });
    expect(sent!.links!.map((l) => l.table).sort()).toEqual(["album_milestones", "story_milestones"]);
  });

  it("sends a member's relationships relative to that member, only for supported types and known people", async () => {
    const store = new FakeStore();
    store.local.family_member = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { given_name: "Me" } }];
    store.state.family_member = [synced("family_member", 1, "me-r"), synced("family_member", 2, "dad-r"), synced("family_member", 3, "wife-r")];
    store.listFamilyRelationships = async () => [
      { from_member_id: 2, to_member_id: 1, relationship_type: "parent" }, // dad is a parent of me
      { from_member_id: 1, to_member_id: 3, relationship_type: "spouse" },
      { from_member_id: 1, to_member_id: 9, relationship_type: "sibling" }, // 9 has no web id
      { from_member_id: 1, to_member_id: 3, relationship_type: "partner" }, // not a type the web accepts
      { from_member_id: 2, to_member_id: 3, relationship_type: "sibling" }, // does not involve me
    ];
    const adapter = new FakeAdapter();
    let sent: Parameters<NonNullable<WebAdapter["pushRelations"]>>[0] | undefined;
    adapter.pushRelations = async (payload) => { sent = payload; return { conflicts: [] }; };

    await new SyncService(store, adapter, "web-master").publish([{ entity_type: "family_member", local_id: 1 }]);

    const set = sent!.family_relationships![0];
    expect(set.member_remote_id).toBe("me-r");
    expect(set.relationships).toEqual([
      { other_remote_id: "dad-r", type: "parent", direction: "to" },
      { other_remote_id: "wife-r", type: "spouse", direction: "from" },
    ]);
    expect(set.known_remote_ids.sort()).toEqual(["dad-r", "me-r", "wife-r"]);
  });

  it("reports problems the web returns and sends nothing when no links apply", async () => {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "S" } }];
    store.state.story = [synced("story", 1, "story-r")];
    store.getLinkedLocalIds = async () => [];
    const adapter = new FakeAdapter();
    adapter.pushRelations = async () => ({ conflicts: ["links:story_albums:story-r:not_found"] });
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(res.errors).toEqual(["links: links:story_albums:story-r:not_found"]);

    const quiet = new SyncService(new FakeStore(), new FakeAdapter(), "web-master");
    expect((await quiet.publish([])).errors).toEqual([]);
  });
});

describe("SyncService.publish — photos", () => {
  const synced = (type: EntityType, id: number, rid: string): SyncState => ({
    entity_type: type, local_id: id, remote_id: rid,
    last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z",
  });

  function setup(fields: Record<string, unknown>) {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "S" } }];
    store.state.story = [synced("story", 1, "story-r")];
    store.getPushFields = async () => ({ title: "S", ...fields });
    const adapter = new FakeAdapter();
    let sent: Record<string, unknown> = {};
    adapter.push = async (_t, records) => {
      sent = records[0].fields;
      return { remoteIdMap: { 1: "story-r" }, remoteUpdatedAt: { 1: "2026-02-01T00:00:00.000Z" }, conflicts: [] };
    };
    return { store, adapter, sent: () => sent };
  }

  it("uploads a local cover image and sends the website address instead of the file path", async () => {
    const { store, adapter, sent } = setup({ featured_image_url: "C:\\app\\images\\cover.jpg" });
    const uploaded: string[] = [];
    adapter.uploadImageFile = async (path) => { uploaded.push(path); return "https://files.lifescribe.us/cover.jpg"; };
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(uploaded).toEqual(["C:\\app\\images\\cover.jpg"]);
    expect(sent().featured_image_url).toBe("https://files.lifescribe.us/cover.jpg");
    expect(res).toMatchObject({ published: 1, errors: [], photos: 1 });
  });

  it("does not re-upload a photo that was downloaded from the website, and never clears an empty one", async () => {
    const { store, adapter, sent } = setup({ featured_image_url: "C:\\Users\\me\\AppData\\Local\\com.lifescribe.app\\media\\img-abc1.jpg" });
    let calls = 0;
    adapter.uploadImageFile = async () => { calls++; return "https://x/y.jpg"; };
    await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(calls).toBe(0);
    expect("featured_image_url" in sent()).toBe(false);

    const empty = setup({ featured_image_url: null });
    empty.adapter.uploadImageFile = async () => { calls++; return "x"; };
    await new SyncService(empty.store, empty.adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(calls).toBe(0);
    expect("featured_image_url" in empty.sent()).toBe(false);
  });

  it("still publishes the record when a photo upload fails, and reports it", async () => {
    const { store, adapter, sent } = setup({ featured_image_url: "C:\\app\\images\\big.jpg" });
    adapter.uploadImageFile = async () => { throw new Error("too large"); };
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(res.published).toBe(1);
    expect(res.errors).toEqual(["story:1 photo: too large"]);
    expect("featured_image_url" in sent()).toBe(false);
  });

  it("uploads photos inside the story text and rewrites them", async () => {
    const body = JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "http://asset.localhost/C%3A%5Cimg%5Cp.jpg" } }] });
    const { store, adapter, sent } = setup({ content: body });
    adapter.uploadImageFile = async (path) => `https://files.lifescribe.us/${path.split("\\").pop()}`;
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "story", local_id: 1 }]);
    expect(JSON.parse(sent().content as string).content[0].attrs.src).toBe("https://files.lifescribe.us/p.jpg");
    expect(res.photos).toBe(1);
  });
});

describe("SyncService.publish — album photos and cover", () => {
  it("uploads each new photo and video link once, records them, and sets the cover", async () => {
    const store = new FakeStore();
    store.local.album = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { name: "Trip" } }];
    const recorded: Array<[number, string, string]> = [];
    store.listAlbumMedia = async () => ({
      coverMediaId: 11,
      media: [
        { id: 10, file_path: "C:\\a.jpg", thumbnail_path: null, filename: "a.jpg", caption: "Hello", source_url: null, mime_type: "image/jpeg", remote_url: null },
        { id: 11, file_path: "C:\\b.jpg", thumbnail_path: null, filename: "b.jpg", caption: null, source_url: null, mime_type: "image/jpeg", remote_url: null },
        { id: 12, file_path: "https://img.youtube.com/vi/x/hqdefault.jpg", thumbnail_path: null, filename: "YouTube – x", caption: null, source_url: "https://www.youtube.com/embed/xxxxxxxxxxx", mime_type: "video/mp4", remote_url: "https://img.youtube.com/vi/x/hqdefault.jpg" },
        { id: 13, file_path: "C:\\done.jpg", thumbnail_path: null, filename: "done.jpg", caption: null, source_url: null, mime_type: "image/jpeg", remote_url: "https://files/done.jpg" },
      ],
    });
    store.recordMediaUploaded = async (id, remoteId, url) => { recorded.push([id, remoteId, url]); await store.putSyncState({ entity_type: "media", local_id: id, remote_id: remoteId, last_synced_at: "t", last_synced_remote_at: "t" }); };
    store.state.media = [{ entity_type: "media", local_id: 13, remote_id: "m13", last_synced_at: "t", last_synced_remote_at: "t" }];

    const adapter = new FakeAdapter();
    const files: Array<[string, string, string | null]> = [];
    adapter.uploadMediaFile = async (path, o) => { files.push([path, o.albumRemoteId, o.caption]); return { mediaId: `m-${path}`, url: `https://files/${o.filename}` }; };
    const links: string[] = [];
    adapter.addMediaLink = async (o) => { links.push(`${o.type}:${o.url}`); return { mediaId: "m-link", url: o.url }; };
    const pushes: Array<Record<string, unknown>> = [];
    adapter.push = async (_t, records) => {
      pushes.push(records[0].fields);
      return { remoteIdMap: { 1: "alb-r" }, remoteUpdatedAt: { 1: "2026-02-01T00:00:00.000Z" }, conflicts: [] };
    };

    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "album", local_id: 1 }]);

    expect(files).toEqual([["C:\\a.jpg", "alb-r", "Hello"], ["C:\\b.jpg", "alb-r", null]]); // the already-uploaded one is skipped
    expect(links).toEqual(["video:https://www.youtube.com/embed/xxxxxxxxxxx"]);
    expect(recorded.map((r) => r[0])).toEqual([10, 11, 12]);
    expect(res).toMatchObject({ published: 1, photos: 3, errors: [] });
    expect(pushes).toHaveLength(2); // the album, then a second update carrying the cover
    expect(pushes[1].cover_image).toBe("https://files/b.jpg");
  });

  it("reports a photo that fails and carries on with the rest", async () => {
    const store = new FakeStore();
    store.local.album = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { name: "Trip" } }];
    store.listAlbumMedia = async () => ({
      coverMediaId: null,
      media: [
        { id: 1, file_path: "C:\\bad.jpg", thumbnail_path: null, filename: "bad.jpg", caption: null, source_url: null, mime_type: "image/jpeg", remote_url: null },
        { id: 2, file_path: "C:\\ok.jpg", thumbnail_path: null, filename: "ok.jpg", caption: null, source_url: null, mime_type: "image/jpeg", remote_url: null },
      ],
    });
    store.recordMediaUploaded = async () => {};
    const adapter = new FakeAdapter();
    adapter.uploadMediaFile = async (path) => { if (path.includes("bad")) throw new Error("Could not read the photo file."); return { mediaId: "m", url: "https://f/ok.jpg" }; };
    const res = await new SyncService(store, adapter, "web-master").publish([{ entity_type: "album", local_id: 1 }]);
    expect(res.photos).toBe(1);
    expect(res.errors).toEqual(["media:1 bad.jpg: Could not read the photo file."]);
  });
});

describe("SyncService — deletions made in the app", () => {
  const tomb = (id: number, type: EntityType, remote_id: string, label: string): PendingDeletion => ({ id, entity_type: type, remote_id, label, deleted_at: "2026-01-01" });

  function withTombs(list: PendingDeletion[]) {
    const store = new FakeStore();
    store.listTombstones = async () => list;
    store.removeTombstone = async (rid) => { const i = list.findIndex((t) => t.remote_id === rid); if (i >= 0) list.splice(i, 1); };
    return store;
  }

  it("Refresh does not bring back a record you deleted in the app", async () => {
    const store = withTombs([tomb(1, "story", "gone", "Old story")]);
    const adapter = new FakeAdapter({
      story: [
        { remote_id: "gone", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "Old story" } },
        { remote_id: "keep", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "Other" } },
      ],
    });
    const summary = await new SyncService(store, adapter, "web-master").refresh();
    expect(store.local.story.map((r) => r.fields.title)).toEqual(["Other"]);
    expect(summary).toMatchObject({ created: 1, keptDeleted: 1 });
  });

  it("removes only the chosen records from the website and forgets them", async () => {
    const list = [tomb(1, "story", "r1", "A"), tomb(2, "album", "r2", "B")];
    const store = withTombs(list);
    const removed: Array<[string, string]> = [];
    const adapter = new FakeAdapter();
    adapter.deleteRemote = async (type, rid) => { removed.push([String(type), String(rid)]); };
    const svc = new SyncService(store, adapter, "web-master");
    const res = await svc.publishDeletions([2]);
    expect(removed).toEqual([["album", "r2"]]);
    expect(res).toEqual({ removed: 1, errors: [] });
    expect((await svc.listDeletions()).map((d) => d.label)).toEqual(["A"]); // the unchosen one is still pending
  });

  it("keeps a record on the list when the website call fails", async () => {
    const list = [tomb(1, "story", "r1", "A")];
    const store = withTombs(list);
    const adapter = new FakeAdapter();
    adapter.deleteRemote = async () => { throw new Error("API 500"); };
    const svc = new SyncService(store, adapter, "web-master");
    const res = await svc.publishDeletions([1]);
    expect(res.removed).toBe(0);
    expect(res.errors).toEqual(["A: API 500"]);
    expect(await svc.listDeletions()).toHaveLength(1);
  });

  it("lets you bring a deleted record back by forgetting the deletion", async () => {
    const list = [tomb(1, "story", "r1", "A")];
    const store = withTombs(list);
    const svc = new SyncService(store, new FakeAdapter(), "web-master");
    await svc.restoreDeleted("r1");
    expect(await svc.listDeletions()).toEqual([]);
  });

  it("does nothing in standalone mode", async () => {
    const store = withTombs([tomb(1, "story", "r1", "A")]);
    const adapter = new FakeAdapter();
    const res = await new SyncService(store, adapter, "standalone").publishDeletions([1]);
    expect(res).toEqual({ removed: 0, errors: [] });
    expect(adapter.writeCalls).toBe(0);
  });
});

describe("SyncService — resolving conflicts", () => {
  const baseState = (): SyncState => ({ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" });

  async function conflicted() {
    const store = new FakeStore();
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "my edit" } }];
    store.state.story = [baseState()];
    const adapter = new FakeAdapter({ story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "web edit" } }] });
    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();
    return { store, adapter, svc, conflict: summary.conflicts[0] };
  }

  it("keeps the website's version of a record when you choose it", async () => {
    const { store, svc, conflict } = await conflicted();
    expect(conflict.remote?.fields.title).toBe("web edit");
    expect(await svc.resolveConflict(conflict, "web")).toEqual({ ok: true });
    expect(store.local.story[0].fields.title).toBe("web edit");
    expect(await svc.listUnpublished()).toEqual([]); // nothing left to publish
  });

  it("publishes your version over the website's when you choose that", async () => {
    const { store, adapter, svc, conflict } = await conflicted();
    let sent: { last_synced_remote_at: string | null; fields: Record<string, unknown> } | undefined;
    adapter.push = async (_t, records) => {
      sent = records[0];
      return { remoteIdMap: { 1: "r1" }, remoteUpdatedAt: { 1: "2026-01-04T00:00:00.000Z" }, conflicts: [] };
    };
    expect(await svc.resolveConflict(conflict, "mine")).toEqual({ ok: true });
    expect(sent!.last_synced_remote_at).toBe("2026-01-02T00:00:00.000Z"); // the website's current version is acknowledged
    expect(store.local.story[0].fields.title).toBe("my edit"); // your text is untouched
    expect((await store.getSyncState("story", 1))!.last_synced_remote_at).toBe("2026-01-04T00:00:00.000Z");
  });

  it("leaves the conflict in place when publishing your version fails", async () => {
    const { store, adapter, svc, conflict } = await conflicted();
    adapter.push = async () => ({ remoteIdMap: {}, remoteUpdatedAt: {}, conflicts: ["stories:1:stale"] });
    const res = await svc.resolveConflict(conflict, "mine");
    expect(res.ok).toBe(false);
    expect(await store.getSyncState("story", 1)).toEqual(baseState());
  });

  it("asks for a fresh Refresh when the website's version was not kept", async () => {
    const { svc, conflict } = await conflicted();
    expect((await svc.resolveConflict({ ...conflict, remote: undefined }, "web")).ok).toBe(false);
  });
});
