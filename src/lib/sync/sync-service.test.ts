import { describe, it, expect } from "vitest";
import { SyncService } from "./sync-service";
import type { DataStore, WebAdapter, LocalRecord, SyncState, RemoteRecord } from "./types";
import type { EntityType } from "./registry";

class FakeStore implements DataStore {
  local: Record<string, LocalRecord[]> = {};
  state: Record<string, SyncState[]> = {};
  nextId = 100;
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
  constructor(public remote: Partial<Record<EntityType, RemoteRecord[]>> = {}) {}
  async pullAll() {
    const out: Record<EntityType, RemoteRecord[]> = {
      biography: [], story: [], milestone: [], career: [],
      map_pin: [], family_member: [], album: [], media: [],
    };
    return { ...out, ...this.remote } as Record<EntityType, RemoteRecord[]>;
  }
  async push(_t: EntityType, records: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }>) {
    this.writeCalls++;
    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    for (const r of records) { remoteIdMap[r.local_id] = r.remote_id ?? `new-${r.local_id}`; remoteUpdatedAt[r.local_id] = "2026-01-03T00:00:00.000Z"; }
    return { remoteIdMap, remoteUpdatedAt };
  }
  async deleteRemote() { this.writeCalls++; }
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
    expect(list).toEqual([{ entity_type: "story", local_id: 1 }]);
  });
});
