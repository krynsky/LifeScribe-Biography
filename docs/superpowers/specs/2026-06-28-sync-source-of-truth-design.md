# Sync & Source-of-Truth Architecture — Design

**Date:** 2026-06-28
**Status:** Approved (design)
**Sub-project:** #1 of 4 (foundation). Later sub-projects — in-app reader view (#2), export to static site (#3), export to PDF/book (#4) — get their own spec → plan → build cycles and are out of scope here.

---

## 1. Goal

Rebuild the desktop app's sync so that:

1. The desktop is a **local-first** biography tool that works fully offline/standalone.
2. The source of truth is **configurable**: `web-master`, `app-master`, or `standalone`.
3. Sync can **never silently overwrite** the other side — the failure mode that destroyed web data on 2026-06-28 is structurally impossible.
4. Sync is a **fully isolated, removable module** so the website (lifescribe.us) can be retired later by deleting one module, with the core app unaffected.

## 2. Background / Motivating Incident

The previous `syncToRemote` did **push (local → web) then pull (web → local)** on every sync, with last-write-wins and no change tracking. Because an earlier pull had sanitized web content (stripping embed nodes the desktop couldn't render), the desktop stored a degraded copy; the next sync **pushed that degraded copy back over the canonical web records**, destroying rich content (e.g. the Google Maps embed in "Where I've Lived"). Recovery required a Neon point-in-time restore.

Root causes:
- Blind, bidirectional, all-records push with no per-record change tracking.
- Sync concerns (`remote_id`, `synced_at`) smeared across core tables.
- No conflict detection; no deletion handling.

## 3. Architecture

**Dependencies only ever point *into* the core.**

- **Core app** — local SQLite + authoring + (future) reader + (future) export. The core never imports anything from sync. Core models describe *a biography*, not *a synced biography*.
- **Sync module** — `src/lib/sync/` with a single public entry (`SyncService`) and a `WebAdapter` behind an interface. The only UI that touches it is the Settings sync panel.
- **Website** — lifescribe.us REST API, reached only through `WebAdapter`. May be retired.

**Removability:** retiring the website later = delete `src/lib/sync/`, remove the Settings sync panel, and run one migration to drop the `sync_state` table. The core compiles and runs unchanged.

**Standalone is the default, not a mode:** with the sync module absent or unconfigured, the app is already a complete local biography tool. No special standalone codepath exists.

### 3.1 Module boundary (interfaces)

```ts
// Local persistence the sync engine needs — implemented over the existing db.ts.
interface DataStore {
  listEntities(type: EntityType): Promise<LocalEntity[]>;
  getEntity(type: EntityType, localId: number): Promise<LocalEntity | null>;
  upsertEntity(type: EntityType, data: LocalEntity): Promise<number>; // returns local id
  deleteEntity(type: EntityType, localId: number): Promise<void>;
  getSyncState(type: EntityType, localId: number): Promise<SyncState | null>;
  listSyncState(type: EntityType): Promise<SyncState[]>;
  putSyncState(s: SyncState): Promise<void>;
  deleteSyncState(type: EntityType, localId: number): Promise<void>;
}

// Remote operations — implemented over the lifescribe.us REST API.
interface WebAdapter {
  pull(type: EntityType, since?: string): Promise<RemoteEntity[]>;
  pullAll(type: EntityType): Promise<RemoteEntity[]>;       // for deletion reconciliation
  push(type: EntityType, data: RemoteEntity): Promise<{ remoteId: string; remoteUpdatedAt: string }>;
  deleteRemote(type: EntityType, remoteId: string): Promise<void>;
}
```

The decision logic (Section 5) is pure and depends on neither interface, so it is unit-testable without Tauri, SQLite, or the network.

## 4. Data Model

**Dirtiness is *derived*, not stored.** The core never tells sync anything.

One sync-owned table:

```sql
CREATE TABLE sync_state (
  entity_type           TEXT NOT NULL,   -- 'biography'|'story'|'milestone'|'career'|'map_pin'|'family_member'|'album'|'media'
  local_id              INTEGER NOT NULL,
  remote_id             TEXT,            -- web CUID; NULL until first published
  last_synced_at        TEXT,            -- local clock (entity.updated_at) at last reconcile
  last_synced_remote_at TEXT,            -- web updatedAt at last reconcile
  PRIMARY KEY (entity_type, local_id)
);
```

Derived state (computed by the sync engine, never written by the core):

- **Unpublished local edit:** `entity.updated_at > sync_state.last_synced_at`
- **Web changed since last sync:** `remote.updatedAt > sync_state.last_synced_remote_at`
- **Conflict:** both true.

The core continues to own and bump each entity's existing `updated_at` on every edit (it already does this) and remains sync-agnostic.

## 5. Sync Flows (per mode)

Three operations. **Refresh never pushes**; pushing is always the separate, explicit **Publish**.

| Operation | `web-master` | `app-master` | `standalone` |
|-----------|--------------|--------------|--------------|
| **Refresh** (web→local) | Pull web records. Web wins for any record not locally edited. A locally-edited record is left untouched (stays "unpublished"); if web also changed it → **conflict**. | Pull only web records **not in `sync_state`** (genuinely new). Existing app-owned records are not overwritten. | n/a |
| **Publish** (local→web, explicit) | Per-item or multi-select push of unpublished edits. Warns if web changed since last sync. | Same; primary flow. | n/a |
| **Reconcile deletes** | Web deletion → delete locally. Local deletion does not push (web re-adds on Refresh). | Local deletion → delete on web. Web deletion does not touch local. | n/a |

**Deletion detection** uses reconciliation, not core hooks:
- Web-master: on a `pullAll`, any `sync_state` row whose `remote_id` is absent from the web response was deleted on the master → delete locally.
- App-master: a `sync_state` row whose `local_id` no longer has a local entity is a local deletion to propagate up via `deleteRemote`.
- Incremental deletion (without a full pull) needs a small "deleted since" addition to the web pull API; full-pull reconciliation covers the common case without it.

**Media** follows the same model: Refresh downloads photos web→local (already built); publishing local photos is an explicit action.

### 5.1 Pure decision function (testable core)

```
decide(localUpdatedAt, syncState, remote, mode) -> Action
  Action ∈ { TakeWeb, KeepLocalUnpublished, Conflict, CreateLocal, DeleteLocal, NoOp }
```

This function takes plain data and returns an action; all branching in the truth table (Section 8) is covered here.

## 6. UI/UX

**Settings → Sync panel** (only UI touching the sync module):
- **Mode selector:** `Web is master` · `App is master` · `Standalone (no sync)`. Standalone disables sync UI but keeps all data.
- **Connection:** existing token + URL fields, shown only when a sync mode is active.
- **Actions:** one **Refresh from web** button (safe, pull-only) and a **Publish…** button (opens review list). The old "Sync Now" and "Re-sync everything" buttons are **removed**.

**Unpublished indicator:** any entity with `entity.updated_at > last_synced_at` shows a small "Unpublished changes" badge in its list row and editor page.

**Publish flow:** **Publish…** opens a review list of unpublished items with checkboxes ("3 items have local changes"); user selects what to push; inline warning on any item the web also changed. Single-item Publish is also available from an item's editor.

**Conflict surfacing:** Refresh leaves both-sides-changed items untouched and lists them under **Conflicts** with a per-item choice: **Keep web version** (discard local edit) or **Keep my version** (mark to publish). No merge editor (YAGNI).

**Reader view hook:** a labeled nav placeholder for sub-project #2; no implementation here.

## 7. Migration & Recovery

**One-time migration (on app update):**
1. Create the `sync_state` table.
2. Backfill: for every core entity with a `remote_id`, insert a `sync_state` row carrying `remote_id` and the old `synced_at` as `last_synced_at`.
3. Drop the `remote_id` / `synced_at` columns from the core tables (SQLite `ALTER TABLE ... DROP COLUMN`).

**Recover current desktop state (it still holds the stripped data):**
After migration, perform a **reset-and-refresh** in web-master mode:
- Records with a `remote_id` are re-pulled fresh and overwritten with the restored, embed-intact web content.
- Locally-created records with no `remote_id` are kept untouched.
- Nothing pushes (pull-only by definition).

Result: desktop matches the restored website, on the new safe model.

## 8. Error Handling & Edge Cases

- **Per-record isolation:** each item syncs in its own transaction; one failure is logged and skipped, never aborting the batch. Summary reports counts (e.g. "47 ok, 1 failed").
- **`sync_state` updated only after a successful local write** — an interrupted sync resumes cleanly on the next Refresh; no half-state.
- **Offline / Neon cold-start:** sync operations fail gracefully (keep the existing 3-second cold-start retry on 5xx); the app keeps working locally.
- **Idempotent:** Refresh and Publish are safe to re-run (timestamp-driven, not one-shot flags).
- **Server-side defense-in-depth:** the web push route rejects a push that would overwrite a record whose web `updatedAt` is newer than the client's last-seen `last_synced_remote_at` (optimistic-concurrency guard).

## 9. Testing Strategy

Add **Vitest** + a `test` script (one lightweight dev dependency; natural fit for this Vite project).

- **Unit tests (primary value):** exhaustively test the pure `decide()` function:
  - not-dirty + web-changed → `TakeWeb`
  - dirty + web-unchanged → `KeepLocalUnpublished` (no push)
  - dirty + web-changed → `Conflict`
  - missing locally + present on web → `CreateLocal` (web-master) / `NoOp` (app-master for existing)
  - present in sync_state + absent from web → `DeleteLocal` (web-master)
  - deletions per mode.
- **Incident regression test:** assert a Refresh in web-master mode issues **zero `WebAdapter` write calls**, and Publish sends **only the selected dirty items**. The exact failure becomes a permanent guard.
- **Flow tests:** drive `SyncService` end-to-end (Refresh → edit → Publish → conflict) against in-memory `DataStore` + `WebAdapter` fakes; verify `sync_state` transitions.
- **Migration test:** run the migration against a seeded SQLite copy; assert `sync_state` is backfilled and old columns dropped.
- **Contract tests:** thin checks that the real `DataStore`/`WebAdapter` implementations satisfy their interfaces.

## 10. Out of Scope

- In-app reader view (#2), static-site export (#3), PDF/book export (#4).
- Real-time/continuous sync (sync is manual/explicit).
- Multi-user collaboration or merge editing.
- Incremental deletion API on the web (full-pull reconciliation suffices for now; noted as a possible later addition).
