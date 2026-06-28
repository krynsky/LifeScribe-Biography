import { describe, it, expect } from "vitest";
import { decide } from "./reconcile";
import type { SyncState } from "./types";

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-01-02T00:00:00.000Z";
const T2 = "2026-01-03T00:00:00.000Z";

function syncState(over: Partial<SyncState> = {}): SyncState {
  return {
    entity_type: "story",
    local_id: 1,
    remote_id: "r1",
    last_synced_at: T1,
    last_synced_remote_at: T1,
    ...over,
  };
}

describe("decide — refresh (web present)", () => {
  it("not-dirty + web-changed => take_web", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: T2 });
    expect(d.action).toBe("take_web");
  });
  it("dirty + web-unchanged => keep_local_unpublished", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T2, state: syncState(), remoteUpdatedAt: T1 });
    expect(d.action).toBe("keep_local_unpublished");
  });
  it("dirty + web-changed => conflict", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T2, state: syncState(), remoteUpdatedAt: T2 });
    expect(d.action).toBe("conflict");
  });
  it("not-dirty + web-unchanged => noop", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: T1 });
    expect(d.action).toBe("noop");
  });
  it("web record with no local state => create_local", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: null, state: null, remoteUpdatedAt: T2 });
    expect(d.action).toBe("create_local");
  });
  it("app-master: existing web change does NOT overwrite app => noop", () => {
    const d = decide({ mode: "app-master", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: T2 });
    expect(d.action).toBe("noop");
  });
  it("app-master: brand-new web record still creates locally => create_local", () => {
    const d = decide({ mode: "app-master", localUpdatedAt: null, state: null, remoteUpdatedAt: T2 });
    expect(d.action).toBe("create_local");
  });
});

describe("decide — deletion (web absent)", () => {
  it("web-master: known remote absent from web => delete_local", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: null });
    expect(d.action).toBe("delete_local");
  });
  it("web-master: locally-edited record deleted on web still deletes (master wins) => delete_local", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T2, state: syncState(), remoteUpdatedAt: null });
    expect(d.action).toBe("delete_local");
  });
  it("app-master: web absence does NOT delete local => noop", () => {
    const d = decide({ mode: "app-master", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: null });
    expect(d.action).toBe("noop");
  });
  it("never-synced local row (no remote_id) is ignored on refresh => noop", () => {
    const d = decide({ mode: "web-master", localUpdatedAt: T2, state: syncState({ remote_id: null }), remoteUpdatedAt: null });
    expect(d.action).toBe("noop");
  });
});

describe("standalone", () => {
  it("standalone always noop", () => {
    const d = decide({ mode: "standalone", localUpdatedAt: T1, state: syncState(), remoteUpdatedAt: T2 });
    expect(d.action).toBe("noop");
  });
});
