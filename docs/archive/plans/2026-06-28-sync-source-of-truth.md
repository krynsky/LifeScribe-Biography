# Sync & Source-of-Truth Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dangerous push-then-pull sync with a local-first, change-tracked, explicit-publish sync that is a removable module and supports `web-master` / `app-master` / `standalone` modes.

**Architecture:** Local SQLite is the source of truth. A `src/lib/sync/` module depends on the core through two interfaces (`DataStore`, `WebAdapter`); the core never imports sync. Dirtiness is *derived* by comparing each entity's `updated_at` against a sync-owned `sync_state` table — so the core stays sync-agnostic and the whole module can be deleted later. Refresh only ever pulls; publishing is an explicit, per-item action.

**Tech Stack:** Tauri 2, React 19, TypeScript, `@tauri-apps/plugin-sql` (SQLite), Vitest (new), the lifescribe.us REST API (existing `/sync/pull`, `/sync/push`, `/sync/media`).

**Spec:** `docs/archive/specs/2026-06-28-sync-source-of-truth-design.md`

---

## Design notes that bind the whole plan

- The desktop reuses the **existing web endpoints**: `GET /sync/pull` returns all entities in local-shaped snake_case (the server already maps fields); `POST /sync/push` upserts a partial `SyncPayload` by `remote_id` and returns `{ remote_id_map }`. Publishing a subset = posting a `SyncPayload` containing only the selected records. Deletion reconciliation = a full `GET /sync/pull` (no `since`) and treating any locally-known `remote_id` absent from the response as deleted.
- **Entity registry** (`registry.ts`) is the single source of truth for which tables sync, their columns, and their pull key. Every generic loop reads it.
- The current `src/lib/sync-service.ts` is deleted at the end (Task 14); its still-needed helpers (media download, the `apiRequest` client) move into the new module.
- Run all commands from `D:/My Data/My Apps/LifeScribe Biography`. The repo uses **pnpm**. `npx vitest` / `npx tsc` work regardless.

## File Structure

### Create (new sync module — `src/lib/sync/`)
- `registry.ts` — `EntityType`, `EntityDef`, `ENTITIES` array. One responsibility: describe syncable entities.
- `types.ts` — `SyncMode`, `SyncState`, `LocalRecord`, `RemoteRecord`, `Decision`, `DataStore`, `WebAdapter` interfaces.
- `reconcile.ts` — pure `decide()` function. No I/O.
- `config.ts` — read/write sync mode + credentials (localStorage).
- `data-store.ts` — `SqlDataStore implements DataStore` over `db.ts`.
- `web-adapter.ts` — `RestWebAdapter implements WebAdapter` + media download, over the REST API.
- `sync-service.ts` — `SyncService` orchestrator (refresh / publish / reconcile / reset).
- `index.ts` — public barrel (exports `SyncService`, `config`, types).

### Create (tests — colocated `*.test.ts`)
- `src/lib/sync/reconcile.test.ts`
- `src/lib/sync/sync-service.test.ts`
- `src/lib/sync/migration.test.ts`

### Modify
- `package.json` — add `vitest` + `test` script.
- `src/lib/db.ts` — add migration `0002_sync_state`.
- `src/pages/settings/SettingsPage.tsx` — replace sync UI (mode selector, Refresh, Publish, conflicts).
- Entity list/editor pages — add "Unpublished" badge (Task 13).
- `apps/web/.../sync/push/route.ts` (web repo) — optimistic-concurrency guard (Task 15).

### Delete
- `src/lib/sync-service.ts` (old) — Task 14, after callers migrated.

---

## Task 1: Vitest setup

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/sync/smoke.test.ts` (temporary)

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the `test` script to `package.json`**

In the `"scripts"` block, add:

```json
    "test": "vitest run",
```

- [ ] **Step 4: Create a smoke test `src/lib/sync/smoke.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/lib/sync/smoke.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "test: add Vitest setup and test script"
```

---

## Task 2: Entity registry

**Files:**
- Create: `src/lib/sync/registry.ts`

This is the single source of truth for syncable entities. `columns` lists the syncable local columns (excludes `id`, `created_at`, `updated_at`, and the now-removed sync columns). `remoteKey` is the array key in the `/sync/pull` response. `singleton` marks `biography` (local id is always 1).

- [ ] **Step 1: Create `src/lib/sync/registry.ts`**

```typescript
export type EntityType =
  | "biography"
  | "story"
  | "milestone"
  | "career"
  | "map_pin"
  | "family_member"
  | "album"
  | "media";

export interface EntityDef {
  type: EntityType;
  /** Local SQLite table name. */
  table: string;
  /** Array key under `data` in the /sync/pull response, and field key in /sync/push payload. */
  remoteKey: string;
  /** Syncable local columns (NOT id/created_at/updated_at). */
  columns: string[];
  /** True for the single-row biography table (local id = 1). */
  singleton?: boolean;
  /** Media is downloaded as binary files rather than upserted as a row of fields. */
  binary?: boolean;
}

export const ENTITIES: EntityDef[] = [
  {
    type: "biography",
    table: "biography",
    remoteKey: "biography",
    singleton: true,
    columns: ["title", "tagline", "bio"],
  },
  {
    type: "story",
    table: "stories",
    remoteKey: "stories",
    columns: ["title", "slug", "content", "excerpt", "status", "event_date", "event_date_precision"],
  },
  {
    type: "milestone",
    table: "milestones",
    remoteKey: "milestones",
    columns: ["title", "description", "date", "date_precision"],
  },
  {
    type: "career",
    table: "career_entries",
    remoteKey: "career",
    columns: ["organization", "title", "description", "start_date", "end_date", "is_current", "location"],
  },
  {
    type: "map_pin",
    table: "map_pins",
    remoteKey: "map_pins",
    columns: ["name", "description", "latitude", "longitude"],
  },
  {
    type: "family_member",
    table: "family_members",
    remoteKey: "family_members",
    columns: ["given_name", "surname", "birth_date", "death_date", "bio"],
  },
  {
    type: "album",
    table: "albums",
    remoteKey: "albums",
    columns: ["name", "description"],
  },
  {
    type: "media",
    table: "media",
    remoteKey: "media",
    binary: true,
    columns: ["filename", "caption", "file_size", "album_id"],
  },
];

export function entityDef(type: EntityType): EntityDef {
  const def = ENTITIES.find((e) => e.type === type);
  if (!def) throw new Error(`Unknown entity type: ${type}`);
  return def;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/registry.ts
git commit -m "feat(sync): add entity registry"
```

---

## Task 3: Types and interfaces

**Files:**
- Create: `src/lib/sync/types.ts`

- [ ] **Step 1: Create `src/lib/sync/types.ts`**

```typescript
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
  deleteLocal(type: EntityType, localId: number): Promise<void>;

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
  push(type: EntityType, records: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }>): Promise<{
    remoteIdMap: Record<number, string>;
    remoteUpdatedAt: Record<number, string>;
  }>;
  deleteRemote(type: EntityType, remoteId: string): Promise<void>;
  /** Download one media file to local storage; returns the local file path. */
  downloadMedia(remote: RemoteRecord): Promise<string>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/types.ts
git commit -m "feat(sync): add sync types and DataStore/WebAdapter interfaces"
```

---

## Task 4: Pure reconciler (`decide`) — TDD

**Files:**
- Create: `src/lib/sync/reconcile.ts`
- Create: `src/lib/sync/reconcile.test.ts`

`decide()` is the heart of the safety model. It takes plain data and returns an action — no I/O. Timestamps are ISO strings compared lexicographically (ISO-8601 sorts chronologically).

- [ ] **Step 1: Write the failing tests `src/lib/sync/reconcile.test.ts`**

```typescript
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
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T1, // == last_synced_at => not dirty
      state: syncState(),
      remoteUpdatedAt: T2, // > last_synced_remote_at => web changed
    });
    expect(d.action).toBe("take_web");
  });

  it("dirty + web-unchanged => keep_local_unpublished", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T2, // > last_synced_at => dirty
      state: syncState(),
      remoteUpdatedAt: T1, // == last_synced_remote_at => unchanged
    });
    expect(d.action).toBe("keep_local_unpublished");
  });

  it("dirty + web-changed => conflict", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T2,
      state: syncState(),
      remoteUpdatedAt: T2,
    });
    expect(d.action).toBe("conflict");
  });

  it("not-dirty + web-unchanged => noop", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T1,
      state: syncState(),
      remoteUpdatedAt: T1,
    });
    expect(d.action).toBe("noop");
  });

  it("web record with no local state => create_local", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: null, // no local row
      state: null,
      remoteUpdatedAt: T2,
    });
    expect(d.action).toBe("create_local");
  });

  it("app-master: existing web change does NOT overwrite app => noop", () => {
    const d = decide({
      mode: "app-master",
      localUpdatedAt: T1,
      state: syncState(),
      remoteUpdatedAt: T2,
    });
    expect(d.action).toBe("noop");
  });

  it("app-master: brand-new web record still creates locally => create_local", () => {
    const d = decide({
      mode: "app-master",
      localUpdatedAt: null,
      state: null,
      remoteUpdatedAt: T2,
    });
    expect(d.action).toBe("create_local");
  });
});

describe("decide — deletion (web absent)", () => {
  it("web-master: known remote absent from web => delete_local", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T1,
      state: syncState(),
      remoteUpdatedAt: null, // not in web response
    });
    expect(d.action).toBe("delete_local");
  });

  it("web-master: locally-edited record deleted on web still deletes (master wins) => delete_local", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T2, // dirty
      state: syncState(),
      remoteUpdatedAt: null,
    });
    expect(d.action).toBe("delete_local");
  });

  it("app-master: web absence does NOT delete local => noop", () => {
    const d = decide({
      mode: "app-master",
      localUpdatedAt: T1,
      state: syncState(),
      remoteUpdatedAt: null,
    });
    expect(d.action).toBe("noop");
  });

  it("never-synced local row (no remote_id) is ignored on refresh => noop", () => {
    const d = decide({
      mode: "web-master",
      localUpdatedAt: T2,
      state: syncState({ remote_id: null }),
      remoteUpdatedAt: null,
    });
    expect(d.action).toBe("noop");
  });
});

describe("standalone", () => {
  it("standalone always noop", () => {
    const d = decide({
      mode: "standalone",
      localUpdatedAt: T1,
      state: syncState(),
      remoteUpdatedAt: T2,
    });
    expect(d.action).toBe("noop");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sync/reconcile.test.ts`
Expected: FAIL ("decide is not a function" / module not found).

- [ ] **Step 3: Implement `src/lib/sync/reconcile.ts`**

```typescript
import type { Decision, SyncMode, SyncState } from "./types";

export interface DecideInput {
  mode: SyncMode;
  /** Local entity updated_at, or null if there is no local row. */
  localUpdatedAt: string | null;
  /** Sync bookkeeping for the local row, or null if none. */
  state: SyncState | null;
  /** Web record updated_at, or null if the record is absent from the web response. */
  remoteUpdatedAt: string | null;
}

// ISO-8601 strings sort chronologically.
const newer = (a: string, b: string) => a > b;

export function decide(input: DecideInput): Decision {
  const { mode, localUpdatedAt, state, remoteUpdatedAt } = input;

  if (mode === "standalone") return { action: "noop" };

  const dirty =
    localUpdatedAt != null &&
    state?.last_synced_at != null &&
    newer(localUpdatedAt, state.last_synced_at);

  const webChanged =
    remoteUpdatedAt != null &&
    (state?.last_synced_remote_at == null ||
      newer(remoteUpdatedAt, state.last_synced_remote_at));

  // ── Web record absent → potential deletion ────────────────────────────────
  if (remoteUpdatedAt == null) {
    // Only records that were previously linked to the web can be "deleted on master".
    if (state?.remote_id == null) return { action: "noop" };
    if (mode === "web-master") return { action: "delete_local" };
    return { action: "noop" }; // app-master: web deletions never touch local
  }

  // ── Web record present, no local counterpart → new web item ───────────────
  if (state == null || localUpdatedAt == null) {
    return { action: "create_local" };
  }

  // ── app-master: app owns existing records; never overwrite from web ───────
  if (mode === "app-master") return { action: "noop" };

  // ── web-master reconciliation ─────────────────────────────────────────────
  if (dirty && webChanged) return { action: "conflict" };
  if (dirty && !webChanged) return { action: "keep_local_unpublished" };
  if (!dirty && webChanged) return { action: "take_web" };
  return { action: "noop" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sync/reconcile.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/reconcile.ts src/lib/sync/reconcile.test.ts
git commit -m "feat(sync): pure decide() reconciler with exhaustive unit tests"
```

---

## Task 5: Database migration (`sync_state` table + backfill + drop columns)

**Files:**
- Modify: `src/lib/db.ts`
- Create: `src/lib/sync/migration.test.ts`

The existing `MIGRATIONS` array in `db.ts` holds `[name, sql]` tuples run in order. Add migration `0002_sync_state`. SQLite (Tauri bundles a modern build) supports `ALTER TABLE ... DROP COLUMN`.

- [ ] **Step 1: Add the migration to `src/lib/db.ts`**

Append this tuple to the `MIGRATIONS` array (after the `0001_initial_schema` entry):

```typescript
  [
    "0002_sync_state",
    `
CREATE TABLE IF NOT EXISTS sync_state (
  entity_type           TEXT NOT NULL,
  local_id              INTEGER NOT NULL,
  remote_id             TEXT,
  last_synced_at        TEXT,
  last_synced_remote_at TEXT,
  PRIMARY KEY (entity_type, local_id)
);

INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'biography', id, remote_id, synced_at, NULL FROM biography WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'story', id, remote_id, synced_at, NULL FROM stories WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'milestone', id, remote_id, synced_at, NULL FROM milestones WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'career', id, remote_id, synced_at, NULL FROM career_entries WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'map_pin', id, remote_id, synced_at, NULL FROM map_pins WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'family_member', id, remote_id, synced_at, NULL FROM family_members WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'album', id, remote_id, synced_at, NULL FROM albums WHERE remote_id IS NOT NULL;
INSERT OR IGNORE INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
  SELECT 'media', id, remote_id, synced_at, NULL FROM media WHERE remote_id IS NOT NULL;

ALTER TABLE biography DROP COLUMN remote_id;
ALTER TABLE biography DROP COLUMN synced_at;
ALTER TABLE stories DROP COLUMN remote_id;
ALTER TABLE stories DROP COLUMN synced_at;
ALTER TABLE milestones DROP COLUMN remote_id;
ALTER TABLE milestones DROP COLUMN synced_at;
ALTER TABLE career_entries DROP COLUMN remote_id;
ALTER TABLE career_entries DROP COLUMN synced_at;
ALTER TABLE map_pins DROP COLUMN remote_id;
ALTER TABLE map_pins DROP COLUMN synced_at;
ALTER TABLE family_members DROP COLUMN remote_id;
ALTER TABLE family_members DROP COLUMN synced_at;
ALTER TABLE albums DROP COLUMN remote_id;
ALTER TABLE albums DROP COLUMN synced_at;
ALTER TABLE media DROP COLUMN remote_id;
ALTER TABLE media DROP COLUMN synced_at;
`,
  ],
```

- [ ] **Step 2: Write a migration test using better-sqlite3 `src/lib/sync/migration.test.ts`**

This test runs the same SQL against an in-memory SQLite to prove backfill + column-drop work. Install the test-only driver first:

```bash
pnpm add -D better-sqlite3 @types/better-sqlite3
```

```typescript
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";

// The exact SQL block from migration 0002 (kept in sync with db.ts).
const MIGRATION_0002 = `
CREATE TABLE sync_state (
  entity_type TEXT NOT NULL, local_id INTEGER NOT NULL, remote_id TEXT,
  last_synced_at TEXT, last_synced_remote_at TEXT, PRIMARY KEY (entity_type, local_id)
);
INSERT OR IGNORE INTO sync_state SELECT 'story', id, remote_id, synced_at, NULL FROM stories WHERE remote_id IS NOT NULL;
ALTER TABLE stories DROP COLUMN remote_id;
ALTER TABLE stories DROP COLUMN synced_at;
`;

describe("migration 0002_sync_state", () => {
  it("backfills sync_state from remote_id and drops the columns", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE stories (id INTEGER PRIMARY KEY, title TEXT, updated_at TEXT, synced_at TEXT, remote_id TEXT);
      INSERT INTO stories (id, title, updated_at, synced_at, remote_id) VALUES (1, 'A', '2026-01-01', '2026-01-01', 'r1');
      INSERT INTO stories (id, title, updated_at, synced_at, remote_id) VALUES (2, 'B', '2026-01-01', NULL, NULL);
    `);

    db.exec(MIGRATION_0002);

    const states = db.prepare("SELECT * FROM sync_state").all() as Array<{ remote_id: string; local_id: number }>;
    expect(states).toHaveLength(1);
    expect(states[0].remote_id).toBe("r1");
    expect(states[0].local_id).toBe(1);

    const cols = db.prepare("PRAGMA table_info(stories)").all() as Array<{ name: string }>;
    const names = cols.map((c) => c.name);
    expect(names).not.toContain("remote_id");
    expect(names).not.toContain("synced_at");
    expect(names).toContain("title");
  });
});
```

- [ ] **Step 3: Run the migration test**

Run: `npx vitest run src/lib/sync/migration.test.ts`
Expected: PASS.

- [ ] **Step 4: Update `src/lib/models/index.ts` — remove `remote_id`/`synced_at` from core interfaces**

In `src/lib/models/index.ts`, delete the `synced_at: string | null;` and `remote_id: string | null;` lines from each of: `Biography`, `Story`, `Milestone`, `Album`, `Media`, `FamilyMember`, `CareerEntry`, `MapPin`. (Leave `media_count?` and all other fields.)

- [ ] **Step 5: Verify compile (expect callers of the old sync-service to still compile — it is untouched until Task 14)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/lib/sync-service.ts` (old file references `remote_id`/`synced_at`). That file is replaced in Task 14. If any OTHER file errors, fix that file's reference. Note the expected errors in your report.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/models/index.ts src/lib/sync/migration.test.ts package.json pnpm-lock.yaml
git commit -m "feat(sync): add sync_state migration; remove sync columns from core models"
```

---

## Task 6: SqlDataStore

**Files:**
- Create: `src/lib/sync/data-store.ts`

Implements `DataStore` over `db.ts`'s `query`/`execute`, driven by the registry. `upsertLocal` keys on `sync_state.remote_id` when present.

- [ ] **Step 1: Create `src/lib/sync/data-store.ts`**

```typescript
import { query, execute } from "../db";
import { entityDef, type EntityType } from "./registry";
import type { DataStore, LocalRecord, SyncState } from "./types";

function toLocalRecord(def: ReturnType<typeof entityDef>, row: Record<string, unknown>): LocalRecord {
  const fields: Record<string, unknown> = {};
  for (const c of def.columns) fields[c] = row[c] ?? null;
  return {
    local_id: row.id as number,
    updated_at: (row.updated_at as string) ?? "",
    fields,
  };
}

export class SqlDataStore implements DataStore {
  async listLocal(type: EntityType): Promise<LocalRecord[]> {
    const def = entityDef(type);
    const rows = await query<Record<string, unknown>>(`SELECT * FROM ${def.table}`);
    return rows.map((r) => toLocalRecord(def, r));
  }

  async getLocal(type: EntityType, localId: number): Promise<LocalRecord | null> {
    const def = entityDef(type);
    const rows = await query<Record<string, unknown>>(`SELECT * FROM ${def.table} WHERE id = ?`, [localId]);
    return rows[0] ? toLocalRecord(def, rows[0]) : null;
  }

  async upsertLocal(type: EntityType, fields: Record<string, unknown>): Promise<number> {
    const def = entityDef(type);
    const cols = def.columns;
    const values = cols.map((c) => fields[c] ?? null);

    if (def.singleton) {
      const set = cols.map((c) => `${c} = ?`).join(", ");
      await execute(
        `UPDATE ${def.table} SET ${set}, updated_at = datetime('now') WHERE id = 1`,
        values
      );
      return 1;
    }

    // Non-singletons are matched to a local row by the caller via sync_state;
    // upsertLocal always INSERTs a fresh row (caller deletes/links as needed).
    const placeholders = cols.map(() => "?").join(", ");
    const res = await execute(
      `INSERT INTO ${def.table} (${cols.join(", ")}, created_at, updated_at)
       VALUES (${placeholders}, datetime('now'), datetime('now'))`,
      values
    );
    return res.lastInsertId;
  }

  async updateLocalById(type: EntityType, localId: number, fields: Record<string, unknown>): Promise<void> {
    const def = entityDef(type);
    const set = def.columns.map((c) => `${c} = ?`).join(", ");
    const values = def.columns.map((c) => fields[c] ?? null);
    await execute(
      `UPDATE ${def.table} SET ${set}, updated_at = datetime('now') WHERE id = ?`,
      [...values, localId]
    );
  }

  async deleteLocal(type: EntityType, localId: number): Promise<void> {
    const def = entityDef(type);
    await execute(`DELETE FROM ${def.table} WHERE id = ?`, [localId]);
  }

  async listSyncState(type: EntityType): Promise<SyncState[]> {
    return query<SyncState>(`SELECT * FROM sync_state WHERE entity_type = ?`, [type]);
  }

  async getSyncState(type: EntityType, localId: number): Promise<SyncState | null> {
    const rows = await query<SyncState>(
      `SELECT * FROM sync_state WHERE entity_type = ? AND local_id = ?`,
      [type, localId]
    );
    return rows[0] ?? null;
  }

  async getSyncStateByRemote(type: EntityType, remoteId: string): Promise<SyncState | null> {
    const rows = await query<SyncState>(
      `SELECT * FROM sync_state WHERE entity_type = ? AND remote_id = ?`,
      [type, remoteId]
    );
    return rows[0] ?? null;
  }

  async putSyncState(s: SyncState): Promise<void> {
    await execute(
      `INSERT INTO sync_state (entity_type, local_id, remote_id, last_synced_at, last_synced_remote_at)
       VALUES (?,?,?,?,?)
       ON CONFLICT(entity_type, local_id) DO UPDATE SET
         remote_id = excluded.remote_id,
         last_synced_at = excluded.last_synced_at,
         last_synced_remote_at = excluded.last_synced_remote_at`,
      [s.entity_type, s.local_id, s.remote_id, s.last_synced_at, s.last_synced_remote_at]
    );
  }

  async deleteSyncStateRow(type: EntityType, localId: number): Promise<void> {
    await execute(`DELETE FROM sync_state WHERE entity_type = ? AND local_id = ?`, [type, localId]);
  }
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: same expected old-`sync-service.ts` errors only.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync/data-store.ts
git commit -m "feat(sync): SqlDataStore over db.ts driven by the registry"
```

---

## Task 7: Sync config (mode + credentials)

**Files:**
- Create: `src/lib/sync/config.ts`

Moves credential storage out of the old service and adds the mode setting.

- [ ] **Step 1: Create `src/lib/sync/config.ts`**

```typescript
import type { SyncMode } from "./types";

const KEY_TOKEN = "lifescribe_sync_token";
const KEY_URL = "lifescribe_sync_url";
const KEY_MODE = "lifescribe_sync_mode";
const DEFAULT_API_URL = "https://lifescribe.us/api/v1";

export function getSyncToken(): string {
  return localStorage.getItem(KEY_TOKEN) ?? "";
}

export function getSyncUrl(): string {
  return localStorage.getItem(KEY_URL) ?? DEFAULT_API_URL;
}

export function getSyncMode(): SyncMode {
  return (localStorage.getItem(KEY_MODE) as SyncMode | null) ?? "web-master";
}

export function setSyncMode(mode: SyncMode): void {
  localStorage.setItem(KEY_MODE, mode);
}

export function saveSyncCredentials(token: string, url?: string): void {
  localStorage.setItem(KEY_TOKEN, token.trim());
  localStorage.setItem(KEY_URL, (url ?? DEFAULT_API_URL).trim());
}

export function clearSyncCredentials(): void {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_URL);
  localStorage.removeItem(KEY_MODE);
}

export function isSyncConfigured(): boolean {
  return !!getSyncToken() && getSyncMode() !== "standalone";
}
```

- [ ] **Step 2: Verify compile + commit**

Run: `npx tsc --noEmit` (expected old-service errors only).

```bash
git add src/lib/sync/config.ts
git commit -m "feat(sync): sync config (mode + credentials)"
```

---

## Task 8: RestWebAdapter

**Files:**
- Create: `src/lib/sync/web-adapter.ts`

Implements `WebAdapter` over the existing endpoints. `pullAll` calls `GET /sync/pull` (no `since`) and regroups the response into `RemoteRecord`s keyed by type using the registry. `push` posts a partial `SyncPayload`. `downloadMedia` reuses the existing binary-download logic.

- [ ] **Step 1: Create `src/lib/sync/web-adapter.ts`**

```typescript
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";
import { ENTITIES, entityDef, type EntityType } from "./registry";
import { getSyncToken, getSyncUrl } from "./config";
import type { RemoteRecord, WebAdapter } from "./types";

interface ApiResponse<T> {
  data: T;
  error?: string;
}

async function api<T>(method: string, path: string, body?: unknown, _retries = 1): Promise<T> {
  const token = getSyncToken();
  const baseUrl = getSyncUrl().replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) {
    if (resp.status >= 500 && _retries > 0) {
      await new Promise((r) => setTimeout(r, 3000));
      return api<T>(method, path, body, _retries - 1);
    }
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text.substring(0, 200)}`);
  }
  const json = (await resp.json()) as ApiResponse<T>;
  if (json.error) throw new Error(json.error);
  return json.data;
}

// The /sync/pull response uses `remote_id` and (for most entities) `updated_at`
// is not returned; the server orders by updatedAt. We carry a synthetic
// remote_updated_at via the server's `updated_at` field when present, else "".
function toRemoteRecords(def: ReturnType<typeof entityDef>, rows: Array<Record<string, unknown>>): RemoteRecord[] {
  return rows.map((r) => {
    const fields: Record<string, unknown> = {};
    for (const c of def.columns) fields[c] = r[c] ?? null;
    return {
      remote_id: r.remote_id as string,
      remote_updated_at: (r.updated_at as string) ?? (r.remote_updated_at as string) ?? "",
      fields,
    };
  });
}

export class RestWebAdapter implements WebAdapter {
  async pullAll(): Promise<Record<EntityType, RemoteRecord[]>> {
    const data = await api<Record<string, Array<Record<string, unknown>>>>("GET", "/sync/pull");
    const out = {} as Record<EntityType, RemoteRecord[]>;
    for (const def of ENTITIES) {
      const rows = (data[def.remoteKey] as Array<Record<string, unknown>>) ?? [];
      out[def.type] = toRemoteRecords(def, rows);
    }
    return out;
  }

  async push(
    type: EntityType,
    records: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }>
  ): Promise<{ remoteIdMap: Record<number, string>; remoteUpdatedAt: Record<number, string> }> {
    const def = entityDef(type);
    // Build a partial SyncPayload: { [remoteKey]: [{...fields, remote_id}] }
    const payloadItems = records.map((r) => ({ ...r.fields, remote_id: r.remote_id, _local_id: r.local_id }));
    const payload: Record<string, unknown> = { [def.remoteKey]: payloadItems };

    const result = await api<{
      remote_id_map: Record<string, string>;
      conflicts: string[];
    }>("POST", "/sync/push", payload);

    // remote_id_map is keyed by "<typeKey>:<local_id>"; map back to local ids.
    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    for (const r of records) {
      const key = `${def.remoteKey}:${r.local_id}`;
      const remoteId = result.remote_id_map[key] ?? r.remote_id;
      if (remoteId) remoteIdMap[r.local_id] = remoteId;
    }
    return { remoteIdMap, remoteUpdatedAt };
  }

  async deleteRemote(type: EntityType, remoteId: string): Promise<void> {
    const def = entityDef(type);
    await api("DELETE", `/sync/${def.remoteKey}/${remoteId}`);
  }

  async downloadMedia(remote: RemoteRecord): Promise<string> {
    const url = remote.fields.url as string;
    const filename = (remote.fields.filename as string) ?? "file";
    const ext = (filename.split(".").pop() ?? "jpg").toLowerCase();
    const dataDir = await appLocalDataDir();
    const mediaDir = await join(dataDir, "media");
    await mkdir(mediaDir, { recursive: true });
    const localPath = await join(mediaDir, `${remote.remote_id}.${ext}`);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`media download ${resp.status}: ${url}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    await writeFile(localPath, bytes);
    return localPath;
  }
}
```

> **Implementer note:** `deleteRemote` and the `_local_id`/`url` passthroughs assume small additions to the web API: `DELETE /sync/{entity}/{remoteId}`, the push route echoing per-item `_local_id` in `remote_id_map`, and `/sync/pull` including `url`/`updated_at` on each record. These are covered by Task 15. If you reach this task before Task 15 deploys, the adapter still compiles; integration is verified after Task 15.

- [ ] **Step 2: Verify compile + commit**

Run: `npx tsc --noEmit` (expected old-service errors only).

```bash
git add src/lib/sync/web-adapter.ts
git commit -m "feat(sync): RestWebAdapter over existing sync endpoints"
```

---

## Task 9: SyncService.refresh() + incident regression test

**Files:**
- Create: `src/lib/sync/sync-service.ts`
- Create: `src/lib/sync/sync-service.test.ts`

`refresh()` pulls all web records and applies `decide()` per record per entity type. **It must never call any WebAdapter write method.** The test enforces that with fakes.

- [ ] **Step 1: Write the failing test `src/lib/sync/sync-service.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { SyncService } from "./sync-service";
import type { DataStore, WebAdapter, LocalRecord, SyncState, RemoteRecord } from "./types";
import type { EntityType } from "./registry";

// ── In-memory fakes ─────────────────────────────────────────────────────────
class FakeStore implements DataStore {
  local: Record<string, LocalRecord[]> = {};
  state: Record<string, SyncState[]> = {};
  nextId = 100;
  k(t: string) { return t; }
  async listLocal(t: EntityType) { return this.local[t] ?? []; }
  async getLocal(t: EntityType, id: number) { return (this.local[t] ?? []).find((r) => r.local_id === id) ?? null; }
  async upsertLocal(t: EntityType, fields: Record<string, unknown>) {
    const id = this.nextId++;
    (this.local[t] ??= []).push({ local_id: id, updated_at: "2026-01-01T00:00:00.000Z", fields });
    return id;
  }
  async updateLocalById() {}
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
  async push() { this.writeCalls++; return { remoteIdMap: {}, remoteUpdatedAt: {} }; }
  async deleteRemote() { this.writeCalls++; }
  async downloadMedia() { return "/local/x.jpg"; }
}

describe("SyncService.refresh — incident regression", () => {
  it("web-master refresh performs ZERO web writes", async () => {
    const store = new FakeStore();
    // a locally-edited (dirty) story that is linked to the web
    store.local.story = [{ local_id: 1, updated_at: "2026-01-03T00:00:00.000Z", fields: { title: "local edit" } }];
    store.state.story = [{ entity_type: "story", local_id: 1, remote_id: "r1", last_synced_at: "2026-01-01T00:00:00.000Z", last_synced_remote_at: "2026-01-01T00:00:00.000Z" }];
    const adapter = new FakeAdapter({
      story: [{ remote_id: "r1", remote_updated_at: "2026-01-02T00:00:00.000Z", fields: { title: "web" } }],
    });

    const svc = new SyncService(store, adapter, "web-master");
    const summary = await svc.refresh();

    expect(adapter.writeCalls).toBe(0); // <-- the incident can never recur
    expect(summary.conflicts.length).toBe(1); // dirty + web-changed
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sync/sync-service.test.ts`
Expected: FAIL (no `SyncService`).

- [ ] **Step 3: Implement `src/lib/sync/sync-service.ts` (refresh only for now)**

```typescript
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

      // 1) Reconcile every web record against local state.
      for (const remote of remotes) {
        seenRemoteIds.add(remote.remote_id);
        try {
          await this.applyRemote(def.type, remote, summary, onProgress);
        } catch (e) {
          summary.errors.push(`${def.type}:${remote.remote_id}: ${(e as Error).message}`);
        }
      }

      // 2) Deletions: local rows linked to a remote that no longer exists.
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
          await (this.store as unknown as { updateLocalById: (t: EntityType, id: number, f: Record<string, unknown>) => Promise<void> })
            .updateLocalById(type, existing.local_id, remote.fields);
          await this.link(type, existing.local_id, remote);
          summary.updated++;
        }
        break;
      }
      case "conflict": {
        if (existing) summary.conflicts.push({ entity_type: type, local_id: existing.local_id, remote_id: remote.remote_id });
        break;
      }
      // keep_local_unpublished, noop, delete_local → nothing here
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
```

> **Note on `updateLocalById`:** it's part of `SqlDataStore` but not the `DataStore` interface (it's an implementation extra used only on `take_web`). Add `updateLocalById(type, localId, fields): Promise<void>` to the `DataStore` interface in `types.ts` so the cast above is unnecessary — do that now and remove the cast.

- [ ] **Step 4: Add `updateLocalById` to the `DataStore` interface in `types.ts`**

In `src/lib/sync/types.ts`, add to `interface DataStore`:

```typescript
  updateLocalById(type: EntityType, localId: number, fields: Record<string, unknown>): Promise<void>;
```

Then in `sync-service.ts` replace the cast in `take_web` with a direct call:

```typescript
          await this.store.updateLocalById(type, existing.local_id, remote.fields);
```

And in the `FakeStore` test double, `updateLocalById` already exists as a no-op — update it to actually mutate so the `updated` assertions are meaningful:

```typescript
  async updateLocalById(t: EntityType, id: number, fields: Record<string, unknown>) {
    const r = (this.local[t] ?? []).find((x) => x.local_id === id);
    if (r) r.fields = fields;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/sync/sync-service.test.ts`
Expected: all PASS, including `writeCalls === 0`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync/sync-service.ts src/lib/sync/sync-service.test.ts src/lib/sync/types.ts
git commit -m "feat(sync): SyncService.refresh with zero-write regression test"
```

---

## Task 10: SyncService.publish() + tests

**Files:**
- Modify: `src/lib/sync/sync-service.ts`
- Modify: `src/lib/sync/sync-service.test.ts`

`publish()` pushes only the explicitly-selected local records, then advances their sync_state so they're no longer "unpublished."

- [ ] **Step 1: Add the failing test to `sync-service.test.ts`**

```typescript
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

    expect(adapter.writeCalls).toBe(1); // exactly one push, only item 1
    const s1 = await store.getSyncState("story", 1);
    expect(s1!.last_synced_at).toBe("2026-01-03T00:00:00.000Z"); // no longer dirty
    const s2 = await store.getSyncState("story", 2);
    expect(s2!.last_synced_at).toBe("2026-01-01T00:00:00.000Z"); // untouched
  });
});
```

Also extend `FakeAdapter.push` to return a usable map so publish can advance state:

```typescript
  async push(_t: EntityType, records: Array<{ local_id: number; remote_id: string | null; fields: Record<string, unknown> }>) {
    this.writeCalls++;
    const remoteIdMap: Record<number, string> = {};
    const remoteUpdatedAt: Record<number, string> = {};
    for (const r of records) { remoteIdMap[r.local_id] = r.remote_id ?? `new-${r.local_id}`; remoteUpdatedAt[r.local_id] = "2026-01-03T00:00:00.000Z"; }
    return { remoteIdMap, remoteUpdatedAt };
  }
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sync/sync-service.test.ts -t publish`
Expected: FAIL (`publish` not a function).

- [ ] **Step 3: Implement `publish` in `sync-service.ts`**

Add this method to the `SyncService` class:

```typescript
  async publish(
    items: Array<{ entity_type: EntityType; local_id: number }>,
    onProgress?: (msg: string) => void
  ): Promise<{ published: number; errors: string[] }> {
    const result = { published: 0, errors: [] as string[] };
    if (this.mode === "standalone") return result;

    // Group selected items by entity type.
    const byType = new Map<EntityType, number[]>();
    for (const it of items) {
      byType.set(it.entity_type, [...(byType.get(it.entity_type) ?? []), it.local_id]);
    }

    for (const [type, localIds] of byType) {
      onProgress?.(`Publishing ${type}…`);
      const records = [];
      for (const localId of localIds) {
        const local = await this.store.getLocal(type, localId);
        const st = await this.store.getSyncState(type, localId);
        if (!local) continue;
        records.push({ local_id: localId, remote_id: st?.remote_id ?? null, fields: local.fields });
      }
      try {
        const { remoteIdMap, remoteUpdatedAt } = await this.adapter.push(type, records);
        for (const rec of records) {
          const local = await this.store.getLocal(type, rec.local_id);
          await this.store.putSyncState({
            entity_type: type,
            local_id: rec.local_id,
            remote_id: remoteIdMap[rec.local_id] ?? rec.remote_id,
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
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/sync/sync-service.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/sync-service.ts src/lib/sync/sync-service.test.ts
git commit -m "feat(sync): explicit publish of selected items + tests"
```

---

## Task 11: Unpublished/dirty query helper + reset-and-refresh

**Files:**
- Modify: `src/lib/sync/sync-service.ts`

`listUnpublished()` powers the Publish review list and badges. `reset()` re-pulls everything fresh (the recovery for the current broken desktop state) by clearing `last_synced_*` so every web record is treated as changed.

- [ ] **Step 1: Add the failing test to `sync-service.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/sync/sync-service.test.ts -t listUnpublished`
Expected: FAIL.

- [ ] **Step 3: Implement `listUnpublished` and `reset` in `sync-service.ts`**

```typescript
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
   * last_synced_remote_at (so decide() sees web as changed) and then refresh().
   * Web-master only; never pushes.
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
```

> Clearing `last_synced_at` to `null` makes `dirty` false (the dirty check requires a non-null `last_synced_at`), so a reset treats local copies as clean and lets web overwrite them — exactly the recovery behavior.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/lib/sync/sync-service.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync/sync-service.ts src/lib/sync/sync-service.test.ts
git commit -m "feat(sync): listUnpublished + reset-and-refresh recovery"
```

---

## Task 12: Public barrel + DI factory

**Files:**
- Create: `src/lib/sync/index.ts`

A single entry point the UI imports, so the rest of the app touches exactly one path.

- [ ] **Step 1: Create `src/lib/sync/index.ts`**

```typescript
import { SqlDataStore } from "./data-store";
import { RestWebAdapter } from "./web-adapter";
import { SyncService } from "./sync-service";
import { getSyncMode } from "./config";

export { SyncService } from "./sync-service";
export * from "./config";
export type { SyncMode, SyncState } from "./types";
export type { RefreshSummary, ConflictItem } from "./sync-service";

/** Build a SyncService wired to the real SQLite store and REST adapter. */
export function makeSyncService(): SyncService {
  return new SyncService(new SqlDataStore(), new RestWebAdapter(), getSyncMode());
}
```

- [ ] **Step 2: Verify compile + commit**

Run: `npx tsc --noEmit` (expected old-service errors only).

```bash
git add src/lib/sync/index.ts
git commit -m "feat(sync): public barrel + makeSyncService factory"
```

---

## Task 13: Settings UI — mode selector, Refresh, Publish, Conflicts

**Files:**
- Modify: `src/pages/settings/SettingsPage.tsx`

Replace the old sync actions. The page imports only from `@/lib/sync`.

- [ ] **Step 1: Update imports in `SettingsPage.tsx`**

Replace the existing sync-service import block:

```typescript
import {
  getSyncToken, getSyncUrl, saveSyncCredentials, clearSyncCredentials,
  isSyncConfigured, testConnection, syncToRemote,
  type RemoteProfile,
} from "@/lib/sync-service";
```

with:

```typescript
import {
  getSyncToken, getSyncUrl, saveSyncCredentials, clearSyncCredentials,
  isSyncConfigured, getSyncMode, setSyncMode,
  makeSyncService, type SyncMode, type ConflictItem,
} from "@/lib/sync";
import { testConnection, type RemoteProfile } from "@/lib/sync/web-profile";
```

> `testConnection`/`RemoteProfile` move into a tiny new file `src/lib/sync/web-profile.ts` in Step 2 (it just calls `GET /me`). This keeps connection-testing inside the sync module.

- [ ] **Step 2: Create `src/lib/sync/web-profile.ts`**

```typescript
import { fetch } from "@tauri-apps/plugin-http";
import { getSyncToken, getSyncUrl } from "./config";

export interface RemoteProfile {
  id: string;
  email: string;
  display_name: string;
  site: { id: string; slug: string; title: string };
}

export async function testConnection(): Promise<RemoteProfile> {
  const baseUrl = getSyncUrl().replace(/\/$/, "");
  const resp = await fetch(`${baseUrl}/me`, {
    headers: { Authorization: `Bearer ${getSyncToken()}` },
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const json = (await resp.json()) as { data: RemoteProfile; error?: string };
  if (json.error) throw new Error(json.error);
  return json.data;
}
```

- [ ] **Step 3: Replace `handleSync`/`handleFullSync` with refresh/publish/reset handlers**

Replace both functions with:

```typescript
  const [mode, setMode] = useState<SyncMode>(getSyncMode());
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [unpublished, setUnpublished] = useState<Array<{ entity_type: string; local_id: number }>>([]);

  function handleModeChange(m: SyncMode) {
    setSyncMode(m);
    setMode(m);
  }

  async function handleRefresh() {
    setSyncing(true);
    setSyncResult(null);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const summary = await svc.refresh((msg) => setSyncStatus(msg));
      setConflicts(summary.conflicts);
      setUnpublished(await svc.listUnpublished());
      setSyncResult({ pushed: 0, pulled: summary.created + summary.updated, conflicts: summary.conflicts.map((c) => `${c.entity_type}:${c.remote_id}`) });
      setSyncStatus(`Refreshed — ${summary.created} new, ${summary.updated} updated, ${summary.deleted} removed, ${summary.conflicts.length} conflicts`);
    } catch (err) {
      setSyncStatus("Refresh failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handleResetRefresh() {
    setSyncing(true);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const summary = await svc.reset((msg) => setSyncStatus(msg));
      setSyncStatus(`Reset complete — ${summary.created + summary.updated} records refreshed from web`);
      setUnpublished(await svc.listUnpublished());
    } catch (err) {
      setSyncStatus("Reset failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }

  async function handlePublishAll() {
    setSyncing(true);
    setSyncStatus("");
    try {
      const svc = makeSyncService();
      const items = await svc.listUnpublished();
      const res = await svc.publish(items, (msg) => setSyncStatus(msg));
      setUnpublished(await svc.listUnpublished());
      setSyncStatus(`Published ${res.published} item${res.published === 1 ? "" : "s"}${res.errors.length ? ` · ${res.errors.length} failed` : ""}`);
    } catch (err) {
      setSyncStatus("Publish failed: " + String(err));
    } finally {
      setSyncing(false);
    }
  }
```

- [ ] **Step 4: Replace the button row markup**

Replace the `<div className="flex gap-2 flex-wrap">` block (the Sync Now / Re-sync everything / Disconnect buttons) with:

```tsx
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-muted)" }}>Source of truth</label>
                  <select
                    value={mode}
                    onChange={(e) => handleModeChange(e.target.value as SyncMode)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                  >
                    <option value="web-master">Web is master</option>
                    <option value="app-master">App is master</option>
                    <option value="standalone">Standalone (no sync)</option>
                  </select>
                </div>

                {mode !== "standalone" && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={handleRefresh} disabled={syncing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-60"
                      style={{ background: "var(--color-primary)" }}>
                      {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {syncing ? "Working…" : "Refresh from web"}
                    </button>
                    <button onClick={handlePublishAll} disabled={syncing || unpublished.length === 0}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border font-medium disabled:opacity-50"
                      style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
                      title="Push your unpublished local edits to the web">
                      Publish{unpublished.length ? ` (${unpublished.length})` : ""}
                    </button>
                    <button onClick={handleResetRefresh} disabled={syncing}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border disabled:opacity-60"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
                      title="Discard local copies of web content and re-pull everything fresh">
                      Reset &amp; re-pull
                    </button>
                    <button onClick={handleDisconnect}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border"
                      style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
                      <LogOut size={13} /> Disconnect
                    </button>
                  </div>
                )}

                {conflicts.length > 0 && (
                  <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--color-border)" }}>
                    <div className="font-medium mb-1" style={{ color: "var(--color-text)" }}>
                      {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"} — edited on both sides
                    </div>
                    <div style={{ color: "var(--color-text-muted)" }}>
                      Resolve by either re-pulling (keep web) or publishing (keep your version) the affected items.
                    </div>
                  </div>
                )}
              </div>
```

- [ ] **Step 5: Load unpublished count on mount**

In the existing `useEffect` that loads sync state on mount, after setting the profile, add:

```typescript
    if (isSyncConfigured()) {
      makeSyncService().listUnpublished().then(setUnpublished).catch(() => {});
    }
```

- [ ] **Step 6: Verify compile**

Run: `npx tsc --noEmit`
Expected: errors only in the old `src/lib/sync-service.ts` (removed next task).

- [ ] **Step 7: Commit**

```bash
git add src/pages/settings/SettingsPage.tsx src/lib/sync/web-profile.ts
git commit -m "feat(settings): mode selector, Refresh, Publish, Reset & conflicts UI"
```

---

## Task 14: Delete the old sync-service; verify whole app compiles

**Files:**
- Delete: `src/lib/sync-service.ts`
- Grep for stragglers.

- [ ] **Step 1: Find remaining importers of the old module**

Run: `npx grep -rn "lib/sync-service" src || true` (or use the editor search).
Expected: only `SettingsPage.tsx` (already migrated) — confirm none remain. If any other file imports `@/lib/sync-service`, repoint it to `@/lib/sync`.

- [ ] **Step 2: Delete the old file**

```bash
git rm src/lib/sync-service.ts
```

- [ ] **Step 3: Full type-check + tests**

Run: `npx tsc --noEmit && pnpm test`
Expected: no type errors anywhere; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(sync): remove old push-then-pull sync-service"
```

---

## Task 15: Web API additions (deletion endpoint, push echo, pull fields, concurrency guard)

**Files (web repo `D:/My Data/My Apps/LifeScribe`):**
- Modify: `apps/web/src/app/api/v1/sync/push/route.ts`
- Modify: `apps/web/src/app/api/v1/sync/pull/route.ts`
- Create: `apps/web/src/app/api/v1/sync/[entity]/[remoteId]/route.ts`

These small server additions back the desktop `WebAdapter`. Commit + push to deploy (Vercel).

- [ ] **Step 1: Pull route — include `updated_at` and (for media) `url` on every record**

In `apps/web/.../sync/pull/route.ts`, each entity mapping currently emits `remote_id`. Add `updated_at: <entity>.updatedAt.toISOString()` to every entity's mapped object (stories, milestones, career, map_pins, family_members, albums, media), and confirm media already includes `url`. Example for stories:

```typescript
    result.stories = posts.map((p) => ({
      // ...existing fields...
      remote_id: p.id,
      updated_at: p.updatedAt.toISOString(),
    }));
```

- [ ] **Step 2: Push route — echo `_local_id` and enforce optimistic concurrency**

In `apps/web/.../sync/push/route.ts`, for each upserted record:
1. Read the incoming `_local_id` and include it in the returned `remote_id_map` key as today (`<typeKey>:<_local_id>`).
2. Before overwriting an existing record, compare the client's `last_synced_remote_at` (add it to each pushed item) against the stored `updatedAt`; if the stored `updatedAt` is newer, skip the write and add the key to a `conflicts` array instead of overwriting.

```typescript
// per item, before update:
if (existing && body.last_synced_remote_at && existing.updatedAt > new Date(body.last_synced_remote_at)) {
  conflicts.push(`${typeKey}:${item._local_id}`);
  continue; // do NOT overwrite newer server data
}
```

- [ ] **Step 3: Create the delete endpoint `apps/web/src/app/api/v1/sync/[entity]/[remoteId]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@lifescribe/database";
import { validateApiToken, type ApiAuthError } from "@/lib/api-auth";

const TABLE: Record<string, string> = {
  stories: "post", milestones: "milestone", career: "careerEntry",
  map_pins: "mapPin", family_members: "familyMember", albums: "album", media: "media",
};

export async function DELETE(req: Request, { params }: { params: Promise<{ entity: string; remoteId: string }> }) {
  let userId: string, siteId: string;
  try { ({ userId, siteId } = await validateApiToken(req)); }
  catch (err) { const e = err as ApiAuthError; return NextResponse.json({ error: e.message }, { status: e.status }); }

  const { entity, remoteId } = await params;
  const model = TABLE[entity];
  if (!model) return NextResponse.json({ error: "Unknown entity" }, { status: 400 });

  const membership = await prisma.siteMember.findUnique({ where: { userId_siteId: { userId, siteId } }, select: { role: true } });
  if (!membership) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  // @ts-expect-error dynamic model access
  await prisma[model].deleteMany({ where: { id: remoteId, siteId } });
  return NextResponse.json({ data: { deleted: true } });
}
```

- [ ] **Step 4: Type-check the web app**

Run: `cd "D:/My Data/My Apps/LifeScribe" && pnpm --filter web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit + push (deploys to Vercel)**

```bash
cd "D:/My Data/My Apps/LifeScribe"
git add apps/web/src/app/api/v1/sync
git commit -m "feat(sync api): per-item delete, push echo + concurrency guard, pull updated_at"
git push origin master
```

Wait for the Vercel deploy to reach "Ready" before the Task 16 smoke test.

---

## Task 16: Build, recover desktop state, and smoke-test

- [ ] **Step 1: Run the desktop app**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
pnpm tauri dev
```
Expected: launches; migration `0002_sync_state` runs once (sync columns dropped, `sync_state` backfilled).

- [ ] **Step 2: Recover the current desktop state**

Settings → Sync → set mode **Web is master** → click **Reset & re-pull**. Expected: status shows records refreshed; the previously-stripped "Where I've Lived" now matches the web (Google Map intact when viewed).

- [ ] **Step 3: Verify safe Refresh**

Click **Refresh from web**. Expected: completes with no errors and (critically) makes no changes to the website — verify by reloading lifescribe.us; content is unchanged.

- [ ] **Step 4: Verify explicit publish**

Edit one story locally. Expected: it appears in the **Publish (N)** count. Click **Publish**; reload lifescribe.us and confirm only that story changed.

- [ ] **Step 5: Verify standalone**

Set mode to **Standalone**. Expected: sync actions disappear; the app still fully works (browse stories, gallery, edit). Confirm no network calls to lifescribe.us occur on normal use.

- [ ] **Step 6: Run the test suite once more**

```bash
cd "D:/My Data/My Apps/LifeScribe Biography"
pnpm test
```
Expected: all green.

---

## Self-Review

**Spec coverage:**
- [x] Local-first, sync as isolated module → `src/lib/sync/*`, core imports nothing from it (Tasks 2–12)
- [x] Removable → barrel + DataStore/WebAdapter boundary; deleting `src/lib/sync/` + Settings panel + `sync_state` removes it (Tasks 12, 5)
- [x] Derived dirtiness, `sync_state` table → Tasks 4, 5, 6
- [x] Modes web/app/standalone → `decide()` + config (Tasks 4, 7)
- [x] Refresh never pushes (incident regression) → Task 9 `writeCalls === 0` test
- [x] Explicit publish of selected items → Task 10
- [x] Master-side delete propagation via reconciliation → Tasks 4, 9
- [x] Migration + reset-and-refresh recovery → Tasks 5, 11, 16
- [x] UI: mode selector, Refresh, Publish, conflicts, unpublished count → Task 13
- [x] Per-record isolation, server concurrency guard → Tasks 9 (try/catch per record), 15
- [x] Vitest + unit/flow/migration/regression tests → Tasks 1, 4, 5, 9, 10, 11

**Known follow-ups (out of scope, noted):**
- Per-item "Unpublished" badges on individual story/album list rows and editor pages were folded into the Settings publish count rather than scattered across every list view, to keep this plan focused. Adding row-level badges is a small follow-up once the core lands.
- `app-master` local-deletion propagation (pushing `deleteRemote` for locally-deleted rows) is supported by the adapter and `decide()` but not yet wired into a publish-time delete sweep; add when app-master becomes a primary workflow.
